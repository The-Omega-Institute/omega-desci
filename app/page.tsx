"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Paper } from "@/lib/mockData";
import { getStats, papers as mockPapers } from "@/lib/mockData";
import { FilterSidebar } from "@/components/archive/FilterSidebar";
import { PaperCard } from "@/components/archive/PaperCard";
import { PaperDrawer } from "@/components/archive/PaperDrawer";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator, Sheet } from "@/components/ui/shadcn";
import { ChevronDown, ExternalLink, Filter, Gavel, Network, Sparkles, X } from "lucide-react";

type ZenodoRecordsResponse = {
  community: string;
  page: number;
  size: number;
  sort: string;
  q: string | null;
  total: number;
  papers: Paper[];
};

type ZenodoRecordResponse = {
  paper: Paper;
};

const PAGE_SIZE = 24;

const POSITIONING_CARDS = [
  {
    tag: "PROTOCOL",
    titleEn: "Claims → Evidence Alignment",
    titleZh: "主张 → 证据对齐",
    bodyEn: "Every conclusion must point to concrete evidence (figures, tables, data, code, commits, hashes, DOIs).",
    bodyZh: "每条结论都必须挂钩到具体证据（图表、数据、代码、提交、哈希、DOI），让复核者能直接验证。",
    cta: { href: "/submit", label: "Try /submit" },
  },
  {
    tag: "AI_REVIEW",
    titleEn: "Structured Epistemic Rubric",
    titleZh: "结构化认识论量表",
    bodyEn: "Models and humans use the same rubric (falsifiability, robustness, reproducibility, ethics), not vague vibes.",
    bodyZh: "模型与人类评审按同一量表产出结构化结论（可证伪性、稳健性、可重复性、伦理风险），拒绝空话打分。",
    cta: { href: "/arxiv", label: "Try /arxiv" },
  },
  {
    tag: "ADVERSARIAL",
    titleEn: "Steelman Attacks + Defense",
    titleZh: "最强反驳 + 逐点辩护",
    bodyEn: "The system generates the strongest critique; authors respond point-by-point and get scored on evidence alignment.",
    bodyZh: "系统自动生成最强反驳清单；作者按表逐点回应，并把回应的证据对齐度量化进评分。",
    cta: { href: "/submit", label: "Open Defense" },
  },
  {
    tag: "REPRO",
    titleEn: "Replication Work Orders",
    titleZh: "可复现实验工单",
    bodyEn: "Controversial claims become reproducibility tickets that validators can claim, submit, and audit (demo economy).",
    bodyZh: "把最有争议的主张自动变成复现工单：验证者可领取、提交 PASS/FAIL，并进入二次审计（demo 激励）。",
    cta: { href: "/market", label: "Try /market" },
  },
  {
    tag: "ARTIFACTS",
    titleEn: "Citeable, Versioned Artifacts",
    titleZh: "可引用、可版本化的产物",
    bodyEn: "Each review emits a hash-addressed artifact (JSON Schema) and a shareable card (URL/iframe).",
    bodyZh: "每次评审都会产出带哈希的可引用 artifact（JSON Schema）以及可分享/可嵌入的卡片页面。",
    cta: { href: "/arxiv", label: "Generate Card" },
  },
  {
    tag: "MAP",
    titleEn: "Explorable Knowledge Map",
    titleZh: "可漫游的知识地图",
    bodyEn: "A zero-backend keyword co-occurrence graph turns the library into a navigable map for discovery.",
    bodyZh: "纯前端关键词共现图，把论文库变成可探索地图：悬停高亮关联论文与关键词，随手漫游找灵感。",
    cta: { href: "/map", label: "Try /map" },
  },
] as const;

function ArchiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [papers, setPapers] = useState<Paper[]>(mockPapers);
  const [total, setTotal] = useState<number | null>(null);
  const [community, setCommunity] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPaperOverride, setSelectedPaperOverride] = useState<Paper | null>(null);

  const stats = useMemo(() => {
    const base = getStats();
    const bountyCount = papers.filter((p) => p.replicationBounty?.active).length;
    const totalELF = papers.reduce((acc, p) => acc + (p.replicationBounty?.amountELF || 0), 48000);
    return {
      paperCount: total ?? papers.length,
      bountyCount,
      totalELF: totalELF || base.totalELF,
    };
  }, [papers, total]);

  const hasMore = total !== null && papers.length < total;

  const loadPage = async (nextPage: number, opts?: { append?: boolean }) => {
    const append = opts?.append ?? false;

    if (append) setLoadingMore(true);
    else setLoadingInitial(true);

    try {
      const res = await fetch(`/api/zenodo/records?page=${nextPage}&size=${PAGE_SIZE}&sort=newest`);
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = (await res.json()) as ZenodoRecordsResponse;
      setCommunity(data.community);
      setTotal(data.total);
      setPage(data.page);
      setPapers((prev) => {
        const next = append ? [...prev, ...data.papers] : data.papers;
        const deduped = new Map(next.map((p) => [p.id, p]));
        return Array.from(deduped.values());
      });
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setLoadError(message);
      setCommunity(null);
      setTotal(null);
      setPage(1);
      setPapers(mockPapers);
    } finally {
      if (append) setLoadingMore(false);
      else setLoadingInitial(false);
    }
  };

  useEffect(() => {
    void loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const selectedPaperId = searchParams.get("paper");
  const selectedPaperFromList = papers.find((p) => p.id === selectedPaperId) || null;
  const selectedPaper =
    selectedPaperOverride && selectedPaperOverride.id === selectedPaperId
      ? selectedPaperOverride
      : selectedPaperFromList;

  useEffect(() => {
    if (!selectedPaperId) {
      setSelectedPaperOverride(null);
      return;
    }
    if (selectedPaperFromList) {
      setSelectedPaperOverride(null);
      return;
    }

    const match = selectedPaperId.match(/^zenodo-(\d+)$/);
    if (!match) {
      setSelectedPaperOverride(null);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/zenodo/record/${match[1]}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as ZenodoRecordResponse;
        setSelectedPaperOverride(data.paper);
      } catch {
        // ignore
      }
    })();

    return () => controller.abort();
  }, [selectedPaperFromList, selectedPaperId]);

  const handleCardClick = (id: string) => {
    router.push(`/?paper=${id}`, { scroll: false });
  };

  const closeDrawer = () => {
    router.push("/", { scroll: false });
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Manifesto / Hero */}
      <section className="border-b border-zinc-800 bg-zinc-950/50 pt-16 pb-12">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl md:text-6xl font-serif font-medium text-white tracking-tight">
              The Archive of Digital Physics.
            </h1>
            <p className="text-xl text-zinc-400 font-light">
              Omega Institute: Make conclusion–evidence alignment academia’s currency.
            </p>
            <p className="text-sm text-zinc-500 font-mono">
              Not a faster submit button—an auditable, reproducible, composable structured review protocol.
            </p>
            <p className="text-sm text-zinc-500 font-mono">
              Omega Institute：让“结论—证据对齐”成为学术的通用货币。不是更快的投稿按钮，而是可审计、可复现、可组合的结构化评审协议。
            </p>
            <div className="flex flex-wrap gap-6 pt-4 text-emerald-500 font-mono text-sm">
              <span className="border-r border-zinc-800 pr-6">{stats.paperCount} Papers Archived</span>
              <span className="border-r border-zinc-800 pr-6">{stats.bountyCount} Replication Bounties</span>
              <span>{stats.totalELF.toLocaleString()} ELF Awarded</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Link href="/arxiv">
                <Button variant="emerald" size="sm" className="font-mono">
                  <Sparkles className="mr-2 h-4 w-4" /> Generate Review Card
                </Button>
              </Link>
              <Link href="/map">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 font-mono">
                  <Network className="mr-2 h-4 w-4" /> Explore Map
                </Button>
              </Link>
              <Link href="/market">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 font-mono">
                  <Gavel className="mr-2 h-4 w-4" /> Bounty Market
                </Button>
              </Link>
            </div>
            <div className="pt-2 text-xs font-mono text-zinc-600">
              {loadingInitial ? (
                <span>SYNCING_ZENODO...</span>
              ) : community ? (
                <span>
                  DATA_SOURCE: ZENODO/{community} {total !== null ? `(${total} records)` : ""}
                </span>
              ) : loadError ? (
                <span>DATA_SOURCE: MOCK (Zenodo unavailable: {loadError})</span>
              ) : (
                <span>DATA_SOURCE: MOCK</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Positioning / Protocol */}
      <section className="border-b border-zinc-800 bg-zinc-950/30 py-10">
        <div className="container px-4 md:px-6">
          <div className="max-w-5xl space-y-6">
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-600">ACADEMIC_POSITIONING_PLAN • PRD_CONTEXT</div>
              <h2 className="text-2xl md:text-3xl font-serif text-zinc-100">Omega Protocol / Omega 协议</h2>
              <p className="text-sm text-zinc-500">
                Omega Institute is an open archive and open review platform for theoretical research and computational foundational research. We do not judge value
                by whether the author is human or AI. We judge by falsifiable claims, traceable derivations, reviewable evidence chains, and a public record of
                review and corrections that accumulates trust levels.
              </p>
              <p className="text-sm text-zinc-500">
                Omega Institute 是一个面向理论型研究与计算型基础研究的开放档案与开放评审平台。我们不根据作者是人类还是 AI 来判断价值。我们只根据可证伪的主张、可追溯的推导、可复核的证据链、公开的评审与纠错记录来累积可信度等级。
              </p>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-4">
              <div className="text-xs font-mono text-emerald-500">MOTIVATION / 动机</div>

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 1: the problem isn’t content scarcity—it’s trust scarcity.</div>
                <div className="text-sm text-zinc-500">动机一：我们要解决的不是内容不够，是信任不够。</div>
                <div className="text-sm text-zinc-400">
                  The internet has never lacked theories. What it lacks is a mechanism that convinces others you’re not just talking to yourself. Omega moves the
                  trust chain from people to evidence and process.
                </div>
                <div className="text-sm text-zinc-500">互联网上从来不缺理论。缺的是让别人相信你不是在自说自话的机制。Omega 要做的是把信任链从人转移到证据和过程。</div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 2: make high-variance exploration and academic credibility coexist.</div>
                <div className="text-sm text-zinc-500">动机二：我们要让高方差探索与学术可信同时成立。</div>
                <div className="text-sm text-zinc-400">
                  High-variance exploration means allowing bold hypotheses, allowing deviations from the mainstream, and allowing work to be immature in its early
                  stages. Traditional journals tend to dislike high-variance work. Omega should attract precisely the people filtered out by that system.
                </div>
                <div className="text-sm text-zinc-500">
                  高方差探索的意思是：允许大胆假设。允许与主流不同。允许在早期很不成熟。传统期刊往往不喜欢高方差。你们要吸引的就是被这个系统排斥的人。
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {POSITIONING_CARDS.map((c) => (
                <Card key={c.tag} className="bg-black/20">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="muted" className="font-mono text-[10px]">
                        {c.tag}
                      </Badge>
                      <Link href={c.cta.href}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-zinc-400 hover:text-emerald-500 font-mono">
                          {c.cta.label} <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                    <CardTitle className="text-zinc-100">
                      {c.titleEn}
                      <span className="block text-sm text-zinc-500 font-normal mt-1">{c.titleZh}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-zinc-400">{c.bodyEn}</p>
                    <p className="text-sm text-zinc-500">{c.bodyZh}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator className="bg-zinc-800" />
            <div className="text-xs text-zinc-500 font-mono">
              This repo is a front-end showcase (no real wallet, no production DB) but ships a realistic protocol surface (schema, artifacts, shareable cards, market).
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              本仓库是前端 Demo（无真钱包/无生产数据库），但已提供“可落地”的协议接口（schema、artifact、卡片分享、工单市场）。
            </div>
          </div>
        </div>
      </section>

      {/* Main Layout */}
      <div className="container px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Sidebar (Desktop) */}
          <div className="hidden md:block md:col-span-3">
             <FilterSidebar />
          </div>

          {/* Main Grid Area */}
          <div className="md:col-span-9 space-y-6">
            
            {/* Mobile Filter Trigger & Sorting */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <Button variant="outline" className="md:hidden w-full border-zinc-700 border-dashed">
                  <Filter className="mr-2 h-4 w-4" /> Filters
               </Button>
               
               <div className="flex flex-wrap items-center gap-2">
                 <Badge variant="emerald" className="cursor-pointer gap-1 pl-1">
                    <X className="w-3 h-3 hover:text-white" /> Code: Available
                 </Badge>
                 <Badge variant="secondary" className="cursor-pointer gap-1 pl-1 bg-zinc-800 text-zinc-400">
                    <X className="w-3 h-3 hover:text-white" /> Type: Preprint
                 </Badge>
                 <span className="text-xs text-zinc-500 ml-2 cursor-pointer hover:text-white underline decoration-dashed">Clear</span>
               </div>

               <div className="flex items-center gap-2 ml-auto">
                 <span className="text-xs text-zinc-500 font-mono">SORT BY:</span>
                 <Button variant="ghost" size="sm" className="h-8 font-mono text-xs">
                    NEWEST <ChevronDown className="ml-1 w-3 h-3" />
                 </Button>
               </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6">
               {papers.map((paper) => (
                 <PaperCard key={paper.id} paper={paper} onClick={handleCardClick} />
               ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  className="border-zinc-700 border-dashed font-mono text-xs"
                  onClick={() => void loadPage(page + 1, { append: true })}
                  disabled={loadingMore}
                >
                  {loadingMore ? "LOADING_MORE..." : "LOAD_MORE"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer */}
      <Sheet open={!!selectedPaper} onOpenChange={(open) => !open && closeDrawer()}>
         <PaperDrawer paper={selectedPaper} />
      </Sheet>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-emerald-500 font-mono">INITIALIZING TERMINAL...</div>}>
      <ArchiveContent />
    </Suspense>
  );
}
