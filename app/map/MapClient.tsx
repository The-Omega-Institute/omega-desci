// Client-only map UI (wrapped by `app/map/page.tsx` Suspense boundary).
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as d3 from "d3";
import type { Paper } from "@/lib/mockData";
import { getStats, papers as mockPapers } from "@/lib/mockData";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from "@/components/ui/shadcn";
import { Network, RefreshCcw, ExternalLink, X } from "lucide-react";

type ZenodoRecordsResponse = {
  community: string;
  page: number;
  size: number;
  sort: string;
  q: string | null;
  total: number;
  papers: Paper[];
  error?: string;
};

type GraphNode = {
  id: string;
  kind: "paper" | "keyword";
  label: string;
  degree: number;
  title?: string;
  doi?: string;
  importedFrom?: string;
  keyword?: string;
  paperId?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
};

const BASE_LINK = "#27272a";
const HIGHLIGHT_LINK = "#10b981";
const PAPER_STROKE = "#10b981";
const KEYWORD_STROKE = "#60a5fa";

function normalizeKeyword(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractKeywordsFallback(text: string, max: number) {
  const t = (text || "").toLowerCase();
  const words = (t.match(/[a-z0-9][a-z0-9-]{2,}/g) || []).map((w) => w.replace(/^-+|-+$/g, ""));
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "into",
    "over",
    "under",
    "using",
    "use",
    "used",
    "via",
    "new",
    "novel",
    "approach",
    "method",
    "methods",
    "model",
    "models",
    "study",
    "paper",
    "results",
    "result",
    "analysis",
    "data",
    "dataset",
    "datasets",
    "based",
    "towards",
    "toward",
    "within",
    "between",
    "across",
    "their",
    "ours",
    "our",
    "its",
    "are",
    "is",
    "was",
    "were",
    "be",
    "can",
    "may",
  ]);
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (stop.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

function buildGraph(papers: Paper[], opts: { topK: number; minKeywordReuse: number }) {
  const topK = Math.min(12, Math.max(1, Math.floor(opts.topK)));
  const minReuse = Math.max(1, Math.floor(opts.minKeywordReuse));

  const paperById = new Map<string, Paper>();
  const paperNodes: GraphNode[] = [];
  const paperKeywordIds = new Map<string, string[]>();

  for (const p of papers) {
    paperById.set(p.id, p);
    paperNodes.push({
      id: p.id,
      kind: "paper",
      label: p.title,
      title: p.title,
      doi: p.doi,
      importedFrom: p.importedFrom,
      degree: 0,
      paperId: p.id,
    });
  }

  const keywordIndex = new Map<
    string,
    {
      canonical: string;
      label: string;
      count: number;
      paperIds: Set<string>;
    }
  >();

  for (const p of papers) {
    const rawKeywords = Array.isArray(p.keywords) && p.keywords.length ? p.keywords : extractKeywordsFallback(`${p.title}\n${p.abstract || ""}`, topK);
    const clean = rawKeywords
      .map((k) => String(k || "").trim())
      .filter(Boolean)
      .slice(0, topK);

    const seen = new Set<string>();
    const kwIds: string[] = [];

    for (const k of clean) {
      const canonical = normalizeKeyword(k);
      if (!canonical) continue;
      if (seen.has(canonical)) continue;
      seen.add(canonical);

      const existing = keywordIndex.get(canonical);
      if (existing) {
        existing.count += 1;
        existing.paperIds.add(p.id);
      } else {
        keywordIndex.set(canonical, { canonical, label: k, count: 1, paperIds: new Set([p.id]) });
      }
    }

    for (const canonical of seen) kwIds.push(`kw:${canonical}`);
    paperKeywordIds.set(p.id, kwIds);
  }

  const keywordNodes: GraphNode[] = [];
  for (const kw of keywordIndex.values()) {
    if (kw.count < minReuse) continue;
    keywordNodes.push({
      id: `kw:${kw.canonical}`,
      kind: "keyword",
      label: kw.label,
      keyword: kw.canonical,
      degree: kw.count,
    });
  }

  const keywordNodeIds = new Set(keywordNodes.map((n) => n.id));
  const links: GraphLink[] = [];
  for (const [paperId, kwIds] of paperKeywordIds) {
    for (const kwId of kwIds) {
      if (!keywordNodeIds.has(kwId)) continue;
      links.push({ source: paperId, target: kwId });
    }
  }

  const nodeById = new Map<string, GraphNode>();
  const nodes = [...paperNodes, ...keywordNodes];
  for (const n of nodes) nodeById.set(n.id, n);

  const neighbors = new Map<string, Set<string>>();
  for (const n of nodes) neighbors.set(n.id, new Set());
  for (const l of links) {
    const s = String(l.source);
    const t = String(l.target);
    neighbors.get(s)?.add(t);
    neighbors.get(t)?.add(s);
    const sn = nodeById.get(s);
    const tn = nodeById.get(t);
    if (sn) sn.degree += 1;
    if (tn && tn.kind === "keyword") {
      // keyword degree already reflects reuse; keep as-is
    } else if (tn) {
      tn.degree += 1;
    }
  }

  return {
    nodes,
    links,
    nodeById,
    neighbors,
    paperById,
    paperKeywordIds,
  };
}

export default function KeywordMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [source, setSource] = useState<{ kind: "zenodo" | "mock"; community?: string; total?: number; error?: string }>({ kind: "mock" });
  const [loading, setLoading] = useState(true);

  const keywordParam = (searchParams.get("keyword") || "").trim();
  const qParam = (searchParams.get("q") || "").trim();
  const initialQuery = keywordParam || qParam;

  const [query, setQuery] = useState(initialQuery);
  const [topK, setTopK] = useState(5);
  const [minReuse, setMinReuse] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setQuery(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordParam, qParam]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionsRef = useRef<{
    svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    link?: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
    node?: d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown>;
    label?: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>;
    simulation?: d3.Simulation<GraphNode, GraphLink>;
  }>({});

  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setDims({ w: Math.max(240, Math.floor(rect.width)), h: Math.max(280, Math.floor(rect.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stats = useMemo(() => {
    const base = getStats();
    return {
      paperCount: source.total ?? papers.length,
      totalELF: base.totalELF,
    };
  }, [papers.length, source.total]);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      try {
        const PAGE_SIZE = 100;
        const MAX_PAPERS = 240;
        const first = await fetch(`/api/zenodo/records?page=1&size=${PAGE_SIZE}&sort=newest`, { cache: "no-store" });
        const firstData = (await first.json()) as ZenodoRecordsResponse;
        if (!first.ok) throw new Error(firstData?.error || `Zenodo API (${first.status})`);

        const totalWanted = Math.min(MAX_PAPERS, firstData.total || 0);
        const pages = Math.max(1, Math.ceil(totalWanted / PAGE_SIZE));
        const restPages = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2);

        const rest = await Promise.all(
          restPages.map(async (p) => {
            const res = await fetch(`/api/zenodo/records?page=${p}&size=${PAGE_SIZE}&sort=newest`, { cache: "no-store" });
            const json = (await res.json()) as ZenodoRecordsResponse;
            if (!res.ok) throw new Error(json?.error || `Zenodo API (${res.status})`);
            return json;
          })
        );

        const combined = [firstData, ...rest]
          .flatMap((r) => r.papers || [])
          .slice(0, totalWanted);
        const deduped = new Map(combined.map((p) => [p.id, p]));
        const finalPapers = Array.from(deduped.values());

        if (canceled) return;
        setPapers(finalPapers);
        setSource({ kind: "zenodo", community: firstData.community, total: firstData.total });
      } catch (err) {
        if (canceled) return;
        const message = err instanceof Error ? err.message : "Failed to load";
        setPapers(mockPapers);
        setSource({ kind: "mock", error: message });
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  const graph = useMemo(() => buildGraph(papers, { topK, minKeywordReuse: minReuse }), [papers, topK, minReuse]);

  const selected = useMemo(() => (selectedId ? graph.nodeById.get(selectedId) || null : null), [graph.nodeById, selectedId]);

  const neighbors = useMemo(() => {
    if (!selected) return { direct: [] as GraphNode[], relatedPapers: [] as GraphNode[] };
    const directIds = graph.neighbors.get(selected.id) || new Set<string>();
    const direct = Array.from(directIds)
      .map((id) => graph.nodeById.get(id))
      .filter(Boolean) as GraphNode[];

    if (selected.kind !== "paper") return { direct, relatedPapers: [] as GraphNode[] };

    const relatedPaperIds = new Set<string>();
    for (const kw of direct.filter((n) => n.kind === "keyword")) {
      const papersForKw = graph.neighbors.get(kw.id) || new Set<string>();
      for (const pid of papersForKw) {
        const node = graph.nodeById.get(pid);
        if (node?.kind === "paper" && pid !== selected.id) relatedPaperIds.add(pid);
      }
    }
    const relatedPapers = Array.from(relatedPaperIds)
      .map((id) => graph.nodeById.get(id))
      .filter(Boolean) as GraphNode[];
    relatedPapers.sort((a, b) => (b.degree || 0) - (a.degree || 0));
    return { direct, relatedPapers: relatedPapers.slice(0, 12) };
  }, [graph.neighbors, graph.nodeById, selected]);

  const nodeRadius = (d: GraphNode) => {
    if (d.kind === "paper") return 4 + Math.sqrt(Math.max(1, d.degree)) * 1.9;
    return 3 + Math.sqrt(Math.max(1, d.degree)) * 1.6;
  };

  const applyFocus = (focusId: string | null) => {
    const { node, link, label } = selectionsRef.current;
    if (!node || !link || !label) return;

    if (!focusId) {
      node.attr("opacity", 1);
      label.attr("opacity", 0.9);
      link.attr("stroke", BASE_LINK).attr("stroke-opacity", 0.55).attr("stroke-width", 1);
      return;
    }

    const focus = new Set<string>([focusId]);
    const direct = graph.neighbors.get(focusId) || new Set<string>();
    for (const id of direct) focus.add(id);

    const focusNode = graph.nodeById.get(focusId);
    if (focusNode?.kind === "paper") {
      for (const kwId of direct) {
        const kwNode = graph.nodeById.get(kwId);
        if (!kwNode || kwNode.kind !== "keyword") continue;
        const papersForKw = graph.neighbors.get(kwId) || new Set<string>();
        for (const pid of papersForKw) focus.add(pid);
      }
    }

    node.attr("opacity", (d) => (focus.has(d.id) ? 1 : 0.12));
    label.attr("opacity", (d) => (focus.has(d.id) ? 0.95 : 0.08));

    link
      .attr("stroke-opacity", (l) => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        return focus.has(s) && focus.has(t) ? 0.8 : 0.06;
      })
      .attr("stroke", (l) => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        return s === focusId || t === focusId ? HIGHLIGHT_LINK : BASE_LINK;
      })
      .attr("stroke-width", (l) => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        return s === focusId || t === focusId ? 1.6 : 1;
      });
  };

  const applySearch = (q: string) => {
    const { node, link, label } = selectionsRef.current;
    if (!node || !link || !label) return;

    const s = (q || "").trim().toLowerCase();
    if (!s) {
      node.style("display", null);
      label.style("display", null);
      link.style("display", null);
      applyFocus(selectedIdRef.current);
      return;
    }

    const matched = new Set<string>();
    for (const n of graph.nodes) {
      const hay = (n.kind === "paper" ? n.title : n.label).toLowerCase();
      if (hay.includes(s)) matched.add(n.id);
    }
    const visible = new Set<string>(matched);
    for (const id of matched) {
      const neigh = graph.neighbors.get(id) || new Set<string>();
      for (const n of neigh) visible.add(n);
    }

    node.style("display", (d) => (visible.has(d.id) ? null : "none"));
    label.style("display", (d) => (visible.has(d.id) ? null : "none"));
    link.style("display", (l) => {
      const sid = typeof l.source === "string" ? l.source : l.source.id;
      const tid = typeof l.target === "string" ? l.target : l.target.id;
      return visible.has(sid) && visible.has(tid) ? null : "none";
    });
    applyFocus(selectedIdRef.current);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!dims.w || !dims.h) return;

    const el = containerRef.current;
    d3.select(el).selectAll("svg").remove();

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", dims.w)
      .attr("height", dims.h)
      .attr("style", "display:block");

    const zoomRoot = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.35, 2.2])
        .on("zoom", (event) => {
          zoomRoot.attr("transform", event.transform.toString());
        })
    );

    const link = zoomRoot
      .append("g")
      .attr("stroke-linecap", "round")
      .selectAll("line")
      .data(graph.links)
      .join("line")
      .attr("stroke", BASE_LINK)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", 1);

    const node = zoomRoot
      .append("g")
      .selectAll("path")
      .data(graph.nodes)
      .join("path")
      .attr("fill", "#09090b")
      .attr("stroke", (d) => (d.kind === "paper" ? PAPER_STROKE : KEYWORD_STROKE))
      .attr("stroke-width", (d) => (d.kind === "paper" ? 1.2 : 1))
      .attr("d", (d) => {
        const r = nodeRadius(d);
        const sym = d.kind === "paper" ? d3.symbolCircle : d3.symbolDiamond;
        return d3.symbol().type(sym).size(r * r * 10)();
      });

    const label = zoomRoot
      .append("g")
      .selectAll("text")
      .data(graph.nodes)
      .join("text")
      .text((d) => (d.kind === "paper" ? String(d.title || d.label).slice(0, 36) : d.label))
      .attr("font-size", 10)
      .attr("fill", "#a1a1aa")
      .attr("opacity", 0.9)
      .style("pointer-events", "none");

    const sim = d3
      .forceSimulation<GraphNode>(graph.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graph.links)
          .id((d) => d.id)
          .distance((l) => {
            const s = typeof l.source === "string" ? graph.nodeById.get(l.source) : l.source;
            const t = typeof l.target === "string" ? graph.nodeById.get(l.target) : l.target;
            if (s?.kind === "keyword" || t?.kind === "keyword") return 58;
            return 70;
          })
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force("collision", d3.forceCollide().radius((d) => nodeRadius(d) + 8));

    const drag = d3
      .drag<SVGPathElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    node
      .on("mouseover", (_event, d) => {
        if (selectedIdRef.current) return;
        applyFocus(d.id);
      })
      .on("mouseout", () => {
        if (selectedIdRef.current) return;
        applyFocus(null);
      })
      .on("click", (_event, d) => {
        const next = selectedIdRef.current === d.id ? null : d.id;
        setSelectedId(next);
        applyFocus(next);
      });

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (typeof d.source === "string" ? graph.nodeById.get(d.source)?.x || 0 : d.source.x || 0))
        .attr("y1", (d) => (typeof d.source === "string" ? graph.nodeById.get(d.source)?.y || 0 : d.source.y || 0))
        .attr("x2", (d) => (typeof d.target === "string" ? graph.nodeById.get(d.target)?.x || 0 : d.target.x || 0))
        .attr("y2", (d) => (typeof d.target === "string" ? graph.nodeById.get(d.target)?.y || 0 : d.target.y || 0));

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
      label.attr("x", (d) => (d.x || 0) + 7).attr("y", (d) => (d.y || 0) + 3);
    });

    selectionsRef.current = { svg, link, node, label, simulation: sim };

    applySearch(query);
    applyFocus(selectedIdRef.current);

    return () => {
      sim.stop();
      d3.select(el).selectAll("svg").remove();
      selectionsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.h, dims.w, graph.links, graph.nodeById, graph.nodes]);

  useEffect(() => {
    applySearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, graph.nodes]);

  const reset = () => {
    setSelectedId(null);
    setQuery("");
    applySearch("");
    applyFocus(null);
    const { svg } = selectionsRef.current;
    svg?.transition().duration(220).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  };

  const openSelectedInArchive = () => {
    if (!selected || selected.kind !== "paper") return;
    router.push(`/?paper=${encodeURIComponent(selected.id)}`, { scroll: false });
  };

  return (
    <div className="container py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-zinc-600">KEYWORD_COOCCURRENCE_MAP • ZERO_DB</div>
            <h1 className="text-2xl md:text-3xl font-serif text-zinc-100">Explore the archive as a map</h1>
            <p className="text-sm text-zinc-500">
              Nodes are papers (circles) and keywords (diamonds). Hover highlights related papers + shared keywords.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted" className="font-mono text-[10px]">
              PAPERS: {stats.paperCount}
            </Badge>
            <Badge variant="muted" className="font-mono text-[10px]">
              GRAPH_NODES: {graph.nodes.length}
            </Badge>
            <Badge variant="muted" className="font-mono text-[10px]">
              LINKS: {graph.links.length}
            </Badge>
            {source.kind === "zenodo" ? (
              <Badge variant="emerald" className="font-mono text-[10px]">
                SOURCE: ZENODO/{source.community}
              </Badge>
            ) : (
              <Badge variant="amber" className="font-mono text-[10px]">
                SOURCE: MOCK{source.error ? ` (${source.error})` : ""}
              </Badge>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-500" />
                Co-occurrence Graph
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="border-zinc-700" onClick={reset}>
                  <X className="mr-2 h-4 w-4" />
                  RESET
                </Button>
                <Button
                  variant="outline"
                  className="border-zinc-700"
                  onClick={() => {
                    setLoading(true);
                    setSelectedId(null);
                    setQuery("");
                    window.location.reload();
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  RELOAD
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <div className="text-xs font-mono text-zinc-600 mb-2">SEARCH</div>
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or keyword (e.g. tcr, wolfram, entropy...)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-mono text-zinc-600 mb-2">TOP_K</div>
                      <Input
                        type="number"
                        value={topK}
                        min={1}
                        max={12}
                        onChange={(e) => setTopK(Number(e.target.value) || 5)}
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-zinc-600 mb-2">MIN_REUSE</div>
                      <Input
                        type="number"
                        value={minReuse}
                        min={1}
                        max={10}
                        onChange={(e) => setMinReuse(Number(e.target.value) || 2)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-zinc-800 bg-black/20">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                    <div className="text-[10px] font-mono text-zinc-600">DRAG • ZOOM • HOVER</div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PAPER_STROKE }} />
                        PAPER
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rotate-45" style={{ background: KEYWORD_STROKE }} />
                        KEYWORD
                      </span>
                    </div>
                  </div>
                  <div ref={containerRef} className="h-[68vh] w-full" />
                </div>

                {loading ? (
                  <div className="text-emerald-500 font-mono text-sm">LOADING_ZENODO...</div>
                ) : (
                  <div className="text-xs font-mono text-zinc-600">
                    Tip: click a node to lock highlight • keywords on paper cards jump here • generate review cards from{" "}
                    <Link href="/arxiv" className="text-emerald-500 hover:underline">
                      /arxiv
                    </Link>
                    .
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-4">
                <div className="border border-zinc-800 bg-black/20 p-4 space-y-3">
                  <div className="text-xs font-mono text-emerald-500">SELECTION</div>
                  {selected ? (
                    <div className="space-y-3">
                      <div className="text-sm text-zinc-200">{selected.kind === "paper" ? selected.title : selected.label}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="muted" className="font-mono text-[10px]">
                          TYPE: {selected.kind.toUpperCase()}
                        </Badge>
                        <Badge variant="muted" className="font-mono text-[10px]">
                          DEGREE: {selected.degree}
                        </Badge>
                        {selected.kind === "paper" && selected.importedFrom ? (
                          <Badge variant="muted" className="font-mono text-[10px]">
                            SOURCE: {String(selected.importedFrom).toUpperCase()}
                          </Badge>
                        ) : null}
                      </div>

                      {selected.kind === "paper" ? (
                        <div className="space-y-2">
                          <Button variant="emerald" className="w-full" onClick={openSelectedInArchive}>
                            OPEN_IN_ARCHIVE
                          </Button>
                          {selected.doi ? (
                            <a href={selected.doi.startsWith("10.") ? `https://doi.org/${selected.doi}` : selected.doi} target="_blank" rel="noreferrer">
                              <Button variant="outline" className="w-full border-zinc-700">
                                OPEN_SOURCE <ExternalLink className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      <Separator className="bg-zinc-800" />

                      <div className="space-y-2">
                        <div className="text-xs font-mono text-zinc-600">DIRECT_NEIGHBORS</div>
                        <div className="flex flex-wrap gap-2">
                          {neighbors.direct
                            .filter((n) => n.kind === "keyword")
                            .slice(0, 12)
                            .map((n) => (
                              <Link key={n.id} href={`/map?keyword=${encodeURIComponent(n.keyword || n.label)}`}>
                                <Badge variant="secondary" className="bg-zinc-900 text-zinc-400 hover:text-emerald-400 cursor-pointer">
                                  {n.label}
                                </Badge>
                              </Link>
                            ))}
                          {selected.kind === "keyword"
                            ? neighbors.direct
                                .filter((n) => n.kind === "paper")
                                .slice(0, 6)
                                .map((n) => (
                                  <div key={n.id} className="text-xs text-zinc-500">
                                    {n.title}
                                  </div>
                                ))
                            : null}
                        </div>
                      </div>

                      {selected.kind === "paper" && neighbors.relatedPapers.length ? (
                        <div className="space-y-2">
                          <div className="text-xs font-mono text-zinc-600">RELATED_PAPERS (2-HOP)</div>
                          <div className="space-y-2">
                            {neighbors.relatedPapers.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left border border-zinc-800 bg-zinc-950/40 p-3 hover:border-emerald-900/60"
                                onClick={() => router.push(`/?paper=${encodeURIComponent(p.id)}`, { scroll: false })}
                              >
                                <div className="text-xs font-mono text-zinc-600">PAPER</div>
                                <div className="text-sm text-zinc-200">{p.title}</div>
                                <div className="text-xs font-mono text-zinc-600 mt-1">DEGREE: {p.degree}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-600 italic">Hover a node to preview; click to lock.</div>
                  )}
                </div>

                <div className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                  <div className="text-xs font-mono text-emerald-500">NAV</div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/">
                      <Button variant="outline" className="border-zinc-700">
                        ARCHIVE
                      </Button>
                    </Link>
                    <Link href="/arxiv">
                      <Button variant="outline" className="border-zinc-700">
                        REVIEW_CARDS
                      </Button>
                    </Link>
                    <Link href="/market">
                      <Button variant="outline" className="border-zinc-700">
                        MARKET
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
