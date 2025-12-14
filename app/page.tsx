"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Paper } from "@/lib/mockData";
import { getStats, papers as mockPapers } from "@/lib/mockData";
import {
  DEFAULT_ARCHIVE_FILTERS,
  filterPapers,
  getHasActiveFilters,
  SORT_OPTIONS,
  sortPapers,
  type ArchiveFilters,
  type SortKey,
} from "@/lib/archive/filters";
import { FilterSidebar } from "@/components/archive/FilterSidebar";
import { PaperCard } from "@/components/archive/PaperCard";
import { PaperDrawer } from "@/components/archive/PaperDrawer";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ScrollArea, Separator, Sheet, SheetContent } from "@/components/ui/shadcn";
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
    tag: "GATES",
    titleEn: "Submission Gates (Structure First)",
    titleZh: "投稿闸门（结构优先）",
    bodyEn:
      "If we don’t want to judge people like traditional journals, we must judge structure like an engineering system. Structured required fields are the platform’s gate.",
    bodyZh: "如果我们不想像传统期刊那样“看人”，就必须像工程系统那样“看结构”。结构化字段就是我们的门槛。",
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
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_ARCHIVE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const clearFilters = () => setFilters(DEFAULT_ARCHIVE_FILTERS);
  const hasActiveFilters = useMemo(() => getHasActiveFilters(filters), [filters]);

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

  const visiblePapers = useMemo(() => {
    const filtered = filterPapers(papers, filters);
    return sortPapers(filtered, sortKey);
  }, [filters, papers, sortKey]);

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

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (sortMenuRef.current?.contains(target)) return;
      setSortOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sortOpen]);
  
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
              We’re building the Archive of Digital Physics.
            </h1>
            <p className="text-xl text-zinc-400 font-light">
              Omega Institute: We turn conclusion–evidence alignment into academia’s currency.
            </p>
            <p className="text-sm text-zinc-500 font-mono">
              We’re not building a faster submit button—we’re building an auditable, reproducible, composable structured review protocol.
            </p>
            <p className="text-sm text-zinc-500 font-mono">
              Omega Institute：我们让“结论—证据对齐”成为学术的通用货币。我们不是在做更快的投稿按钮，而是在做可审计、可复现、可组合的结构化评审协议。
            </p>
            <div className="flex flex-wrap gap-6 pt-4 text-emerald-500 font-mono text-sm">
              <span className="border-r border-zinc-800 pr-6">{stats.paperCount} Papers Archived</span>
              <span className="border-r border-zinc-800 pr-6">{stats.bountyCount} Replication Bounties</span>
              <span>{stats.totalELF.toLocaleString()} ELF Awarded</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              <div className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                <div className="text-[10px] font-mono text-emerald-500">WHAT_WE_WANT / 我们要做什么</div>
                <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                  <li>
                    <div>We build an open archive + open review protocol for theoretical and computational foundational research.</div>
                    <div className="text-zinc-500">我们要做面向理论与计算基础研究的开放档案 + 开放评审协议。</div>
                  </li>
                  <li>
                    <div>
                      We shift trust from identity to an auditable chain: claims → assumptions → evidence → derivations → versions → reviews → verification → corrections.
                    </div>
                    <div className="text-zinc-500">我们把信任从身份转移到可审计链条：主张→假设→证据→推导→版本→评审→复核→纠错。</div>
                  </li>
                  <li>
                    <div>We make disputes converge by going claim-first and requiring falsifiability paths and structured reviews.</div>
                    <div className="text-zinc-500">我们让争议可收敛：主张优先（Claim-first）+ 可证伪路径 + 结构化评审。</div>
                  </li>
                </ul>
              </div>

              <div className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                <div className="text-[10px] font-mono text-emerald-500">WHAT_WE_BUILT / 我们已经做了什么（Demo）</div>
                <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                  <li>
                    <div>
                      Zenodo community archive on the homepage (default: <span className="font-mono text-zinc-300">the-matrix</span>).
                    </div>
                    <div className="text-zinc-500">
                      首页已接入 Zenodo 社区归档（默认：<span className="font-mono text-zinc-300">the-matrix</span>）。
                    </div>
                  </li>
                  <li>
                    <div>
                      Zero-backend keyword co-occurrence map: <span className="font-mono text-zinc-300">/map</span>.
                    </div>
                    <div className="text-zinc-500">
                      纯前端关键词共现图：<span className="font-mono text-zinc-300">/map</span>。
                    </div>
                  </li>
                  <li>
                    <div>
                      AI audit + rubric + steelman artifacts: <span className="font-mono text-zinc-300">/arxiv</span> + paper drawer tabs.
                    </div>
                    <div className="text-zinc-500">
                      AI 审计 + 量表 + steelman 产物：<span className="font-mono text-zinc-300">/arxiv</span> + 论文抽屉各标签页。
                    </div>
                  </li>
                  <li>
                    <div>
                      Bounty market simulation with audit-weighted settlement: <span className="font-mono text-zinc-300">/market</span>.
                    </div>
                    <div className="text-zinc-500">
                      带随机审计的赏金市场模拟：<span className="font-mono text-zinc-300">/market</span>。
                    </div>
                  </li>
                  <li>
                    <div>
                      Policy hub + reputation profile: <span className="font-mono text-zinc-300">/policies</span> + <span className="font-mono text-zinc-300">/profile</span>.
                    </div>
                    <div className="text-zinc-500">
                      政策中心 + 声望档案：<span className="font-mono text-zinc-300">/policies</span> + <span className="font-mono text-zinc-300">/profile</span>。
                    </div>
                  </li>
                </ul>
                <div className="text-xs text-zinc-600">
                  Demo only: no real wallet, no production DB; mock/local-storage friendly. / Demo 仅展示：无真钱包、无生产数据库；对 mock 与本地存储友好。
                </div>
              </div>
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

      {/* Main Layout */}
      <div className="container px-4 md:px-6 py-8">
        {/* Mobile Filters */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="left" className="p-0 sm:max-w-sm w-full border-r border-zinc-800">
            <div className="p-4 border-b border-zinc-800">
              <div className="text-[10px] font-mono text-zinc-600">ARCHIVE_FILTERS</div>
              <div className="text-sm text-zinc-400 mt-1">Refine the archive view</div>
            </div>
            <ScrollArea className="h-[calc(100vh-120px)] p-4">
              <FilterSidebar value={filters} onChange={setFilters} onClear={clearFilters} className="pr-0" />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar (Desktop) */}
          <div className="hidden md:block md:col-span-3">
            <FilterSidebar value={filters} onChange={setFilters} onClear={clearFilters} />
          </div>

          {/* Main Grid Area */}
          <div className="md:col-span-9 space-y-6">
            {/* Mobile Filter Trigger & Sorting */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <Button
                type="button"
                variant="outline"
                className="md:hidden w-full border-zinc-700 border-dashed"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {filters.requireCode ? (
                  <Badge
                    variant="emerald"
                    className="cursor-pointer gap-1 pl-1"
                    role="button"
                    tabIndex={0}
                    onClick={() => setFilters((prev) => ({ ...prev, requireCode: false }))}
                  >
                    <X className="w-3 h-3 hover:text-white" /> Code: Available
                  </Badge>
                ) : null}
                {filters.requireData ? (
                  <Badge
                    variant="emerald"
                    className="cursor-pointer gap-1 pl-1"
                    role="button"
                    tabIndex={0}
                    onClick={() => setFilters((prev) => ({ ...prev, requireData: false }))}
                  >
                    <X className="w-3 h-3 hover:text-white" /> Data: Available
                  </Badge>
                ) : null}
                {filters.articleTypes.map((t) => (
                  <Badge
                    key={`type:${t}`}
                    variant="secondary"
                    className="cursor-pointer gap-1 pl-1 bg-zinc-800 text-zinc-400"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        articleTypes: prev.articleTypes.filter((x) => x !== t),
                      }))
                    }
                  >
                    <X className="w-3 h-3 hover:text-white" /> Type: {t}
                  </Badge>
                ))}
                {filters.disciplines.map((d) => (
                  <Badge
                    key={`disc:${d}`}
                    variant="outline"
                    className="cursor-pointer gap-1 pl-1 border-zinc-700 text-zinc-400"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        disciplines: prev.disciplines.filter((x) => x !== d),
                      }))
                    }
                  >
                    <X className="w-3 h-3 hover:text-white" /> {d}
                  </Badge>
                ))}
                {filters.minLevel !== null ? (
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 pl-1 border-zinc-700 text-zinc-400"
                    role="button"
                    tabIndex={0}
                    onClick={() => setFilters((prev) => ({ ...prev, minLevel: null }))}
                  >
                    <X className="w-3 h-3 hover:text-white" /> Level ≥ {filters.minLevel}
                  </Badge>
                ) : null}

                {!hasActiveFilters ? <span className="text-xs text-zinc-700 font-mono">No filters</span> : null}

                <span
                  className={
                    "text-xs ml-2 underline decoration-dashed " +
                    (hasActiveFilters ? "text-zinc-500 cursor-pointer hover:text-white" : "text-zinc-800 cursor-not-allowed")
                  }
                  onClick={hasActiveFilters ? clearFilters : undefined}
                >
                  Clear
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto relative" ref={sortMenuRef}>
                <span className="text-xs text-zinc-500 font-mono">SORT BY:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 font-mono text-xs"
                  onClick={() => setSortOpen((prev) => !prev)}
                >
                  {SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "NEWEST"} <ChevronDown className="ml-1 w-3 h-3" />
                </Button>
                {sortOpen ? (
                  <div className="absolute right-0 top-full mt-1 w-56 border border-zinc-800 bg-zinc-950 shadow-lg z-50">
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt.key === sortKey;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          className={
                            "w-full text-left px-3 py-2 text-xs font-mono border-b border-zinc-800 last:border-b-0 " +
                            (active ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-300 hover:bg-zinc-900/60")
                          }
                          onClick={() => {
                            setSortKey(opt.key);
                            setSortOpen(false);
                          }}
                        >
                          <div className="text-[11px]">{opt.label}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{opt.description}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6">
              {visiblePapers.map((paper) => (
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

      {/* Positioning / Protocol */}
      <section className="border-b border-zinc-800 bg-zinc-950/30 py-10">
        <div className="container px-4 md:px-6">
          <div className="max-w-5xl space-y-6">
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-600">ACADEMIC_POSITIONING_PLAN • PRD_CONTEXT</div>
              <h2 className="text-2xl md:text-3xl font-serif text-zinc-100">Omega Protocol / Omega 协议</h2>
              <p className="text-sm text-zinc-500">
                We’re building Omega Institute as an open archive and open review platform for theoretical research and computational foundational research. We do
                not judge value by whether the author is human or AI. We judge by falsifiable claims, traceable derivations, reviewable evidence chains, and a
                public record of review and corrections that accumulates trust levels.
              </p>
              <p className="text-sm text-zinc-500">
                我们正在打造 Omega Institute：一个面向理论型研究与计算型基础研究的开放档案与开放评审平台。我们不根据作者是人类还是 AI 来判断价值，而是根据可证伪的主张、可追溯的推导、可复核的证据链，以及公开的评审与纠错记录来累积可信度等级。
              </p>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-4">
              <div className="text-xs font-mono text-emerald-500">MOTIVATION / 动机</div>

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 1: the problem isn’t content scarcity—it’s trust scarcity.</div>
                <div className="text-sm text-zinc-500">动机一：我们要解决的不是内容不够，是信任不够。</div>
                <div className="text-sm text-zinc-400">
                  The internet has never lacked theories. What it lacks is a mechanism that convinces others a work isn’t just self-talk. We move the trust chain
                  from people to evidence and process.
                </div>
                <div className="text-sm text-zinc-500">互联网上从来不缺理论。缺的是让别人相信一条理论不是“自说自话”的机制。我们把信任链从人转移到证据和过程。</div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 2: make high-variance exploration and academic credibility coexist.</div>
                <div className="text-sm text-zinc-500">动机二：我们要让高方差探索与学术可信同时成立。</div>
                <div className="text-sm text-zinc-400">
                  High-variance exploration means allowing bold hypotheses, allowing deviations from the mainstream, and allowing work to be immature in its early
                  stages. Traditional journals tend to dislike high-variance work. We want to attract precisely the people filtered out by that system. Without
                  credibility stratification, high-variance exploration becomes noise; readers will experience it as mysticism.
                </div>
                <div className="text-sm text-zinc-500">
                  高方差探索的意思是：允许大胆假设。允许与主流不同。允许在早期很不成熟。传统期刊往往不喜欢高方差。我们要吸引的正是被这个系统排斥的人。但如果没有可信度分层，高方差就会变成噪音。读者会觉得全是玄学。
                </div>
              <div className="text-sm text-zinc-400">
                  Platform strategy: we carry high variance with credibility levels. Level 0 is Archived. Level 1 is Policy Complete. Level 2 is Open Reviewed
                  (public, structured reviews). Level 3 is Verified (independent re-audit/verification). We never promise Level 0 or Level 1 conclusions are
                  correct—we only promise the record is complete and traceable.
                </div>
                <div className="text-sm text-zinc-500">
                  对应平台策略是：用可信度等级来承载高方差。Level 0 是 Archived。Level 1 是 Policy Complete。Level 2 是 Open Reviewed（公开+结构化评审）。Level 3 是 Verified
                  （独立复核/验证）。平台从不承诺 Level 0 或 Level 1 的结论正确，只承诺记录完整可追溯。
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 3: we don’t judge humans or AI—but we must support accountability and re-audit.</div>
                <div className="text-sm text-zinc-500">动机三：我们不 judge 人或 AI。但必须能追责和复核。</div>
                <div className="text-sm text-zinc-400">
                  “Not judging” means we don’t dismiss work because it was written with AI, and we don’t award points because the author is a famous professor from
                  an elite institution.
                </div>
                <div className="text-sm text-zinc-500">不 judge 的意思是：不因为作者是 AI 写的就否定，也不因为作者是名校教授就加分。</div>
                <div className="text-sm text-zinc-400">
                  But an academic system needs two non-negotiable baselines: a responsible party and method provenance. Without them, errors cannot be corrected and
                  disputes cannot converge.
                </div>
                <div className="text-sm text-zinc-500">但学术系统必须有两个底线：责任主体。方法来源。否则任何错误都没法纠正，任何争议都没法收敛。</div>
                <div className="text-sm text-zinc-400">
                  Platform strategy: we do not run an AI morality court. We do method and provenance disclosure. If a tool or automated workflow affects the
                  derivation, code, data, conclusions, or figures, it is part of the methodology and must be recorded. The goal is re-audit, not labeling.
                </div>
                <div className="text-sm text-zinc-500">
                  对应平台策略是：我们不做 AI 道德审判，我们做方法与来源披露。只要某种工具或自动化流程影响了推导、代码、数据、结论或图表，它就属于方法学的一部分，必须记录，目的是复核，不是贴标签。
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">Motivation 4: turn peer review from a black box into a reusable public asset.</div>
                <div className="text-sm text-zinc-500">动机四：我们要把审稿从黑箱变成可复用的公共资产。</div>
                <div className="text-sm text-zinc-400">
                  Traditional peer review often suffers from: black-box processes, slowness, individual bias, review reports that cannot be cited, and reviewer
                  contributions that are not counted as academic assets.
                </div>
                <div className="text-sm text-zinc-500">传统审稿常见问题是：黑箱。慢。个人偏见。审稿意见不能被引用。审稿人贡献不被计入学术资产。</div>
                <div className="text-sm text-zinc-400">
                  Platform strategy: open review, structured review, citable reviews, and reviews that earn reputation and rewards. A review is a publishable
                  object—not a comment-section fight.
                </div>
                <div className="text-sm text-zinc-500">
                  对应平台策略是：公开评审。结构化评审。评审可引用。评审可获得声望与奖励。评审也是一种出版对象，不是评论区吵架。
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">NORTH STAR / 北极星原则</div>
              <div className="text-sm text-zinc-400">2. North Star principles: all features must obey these five.</div>
              <div className="text-sm text-zinc-500">2. 平台的北极星原则。所有功能都要服从这五条。</div>
              <div className="text-sm text-zinc-400">These five principles are our constitution for every future product trade-off.</div>
              <div className="text-sm text-zinc-500">这五条是我们以后每次产品取舍的宪法。</div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">1. Tool-neutral</div>
                <div className="text-sm text-zinc-500">1. 工具中立（Tool-neutral）</div>
                <div className="text-sm text-zinc-400">Do not judge research value by whether the author is human or AI. Judge only the evidence chain and re-auditability.</div>
                <div className="text-sm text-zinc-500">不因为作者是人类或 AI 评判研究价值。只评判证据链和可复核性。</div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">2. Accountability-first</div>
                <div className="text-sm text-zinc-500">2. 可追责优先（Accountability-first）</div>
                <div className="text-sm text-zinc-400">
                  Every public research record must have an accountable responsible party. Content without a responsible party can only exist as anonymous discussion
                  and does not enter the academic archive system.
                </div>
                <div className="text-sm text-zinc-500">
                  每条公开研究记录必须有可追责主体。没有责任主体的内容只能作为匿名讨论，不进入学术档案体系。
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">3. Claim-first</div>
                <div className="text-sm text-zinc-500">3. 主张优先（Claim-first）</div>
                <div className="text-sm text-zinc-400">All discussion revolves around numbered claims. Without claim IDs, debates cannot converge.</div>
                <div className="text-sm text-zinc-500">所有讨论都围绕可编号主张展开。没有主张编号就没有可收敛的争论。</div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">4. Falsifiability and verification</div>
                <div className="text-sm text-zinc-500">4. 可证伪与可验证（Falsifiability & verification）</div>
                <div className="text-sm text-zinc-400">
                  Every theoretical work must state its assumptions and falsifiability path. Omega encourages re-audit, counterexample search, formal verification,
                  and simulation-based reproduction—and treats them as the highest-value contributions.
                </div>
                <div className="text-sm text-zinc-500">
                  每篇理论研究必须写明假设和可证伪路径。平台鼓励复核、反例搜索、形式化验证、模拟复现，并将其作为最高价值贡献。
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">5. Transparent governance</div>
                <div className="text-sm text-zinc-500">5. 透明治理（Transparent governance）</div>
                <div className="text-sm text-zinc-400">
                  Any upgrade, delisting, folding, retraction, or bounty payout must have traceable records and reasons to avoid black-box governance.
                </div>
                <div className="text-sm text-zinc-500">任何升级、下架、折叠、撤稿、赏金发放都必须有可追踪记录与理由，避免黑箱。</div>
                <div className="text-sm text-zinc-400">Demo: moderation actions write a per-paper Governance Log (paper drawer → Governance tab).</div>
                <div className="text-sm text-zinc-500">Demo：所有审核动作都会写入每篇论文的治理日志（paper drawer → Governance）。</div>
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">SCOPE / 学科范围</div>
              <div className="text-sm text-zinc-400">3. Disciplinary scope & article types: making a theory-leaning scope executable.</div>
              <div className="text-sm text-zinc-500">3. 学科范围与文章类型。偏理论的 Scope 如何写成可执行规则。</div>
              <Separator className="bg-zinc-800" />
              <div className="space-y-2">
                <div className="text-sm text-zinc-400">3.1 A three-layer way to write scope.</div>
                <div className="text-sm text-zinc-500">3.1 Scope 三层写法。</div>
                <div className="text-sm text-zinc-400">
                  We don’t write “we care about the essence of the universe” in policy. That’s narrative, not scope. Scope must be usable for moderation/review and
                  filtering.
                </div>
                <div className="text-sm text-zinc-500">我们的政策不会只写“我们关注宇宙本质”。那是叙事，不是范围；范围必须能用于审核与筛选。</div>
                <Separator className="bg-zinc-800" />
                <div className="text-sm text-zinc-400">Recommendation (3 layers):</div>
                <div className="text-sm text-zinc-500">建议用三层：</div>
                <div className="text-sm text-zinc-400">
                  A) Core scope (accepted by default) → B) Extended scope (accepted but labeled speculative / higher bar) → C) Not in the main track (separate
                  track or not accepted).
                </div>
                <div className="text-sm text-zinc-500">A) 核心范围（默认接受）→ B) 扩展范围（接受但标注 speculative/提高门槛）→ C) 暂不进入主轨道（需要单独轨道或不收）。</div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">A) Core scope (accepted by default)</div>
                <div className="text-sm text-zinc-500">A) 核心范围。默认接受</div>
                <div className="text-sm text-zinc-400">- Digital Physics; Cellular Automata; Computational Universe Models</div>
                <div className="text-sm text-zinc-400">- Thermodynamics; Information Theory; Entropy; Complex Systems</div>
                <div className="text-sm text-zinc-400">- Foundations of AI; Foundations of Computation; Algorithmic Information</div>
                <div className="text-sm text-zinc-400">- Computational Cosmology; simulation-based theory exploration</div>
                <div className="text-sm text-zinc-400">- Mathematical physics and formal systems strongly related to the above</div>
                <div className="text-sm text-zinc-500">- Digital Physics。Cellular Automata。Computational Universe Models</div>
                <div className="text-sm text-zinc-500">- Thermodynamics。Information Theory。Entropy。Complex Systems</div>
                <div className="text-sm text-zinc-500">- Foundations of AI。Foundations of Computation。Algorithmic Information</div>
                <div className="text-sm text-zinc-500">- Computational Cosmology。Simulation-based theory exploration</div>
                <div className="text-sm text-zinc-500">- 与上述强相关的数学物理与形式化系统</div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">B) Extended scope (accepted but labeled speculative or requires a higher bar)</div>
                <div className="text-sm text-zinc-500">B) 扩展范围。接受但标注 speculative 或提高门槛</div>
                <div className="text-sm text-zinc-400">- Grand unification theories; ontological-style deductions about the universe</div>
                <div className="text-sm text-zinc-400">
                  Must meet stronger structural requirements: stricter assumption lists; a concrete falsifiability path; and a clear statement of which parts are
                  currently untestable.
                </div>
                <div className="text-sm text-zinc-500">- 宏大统一理论。宇宙本体论式推导</div>
                <div className="text-sm text-zinc-500">
                  必须满足更强结构要求：假设清单更严格。可证伪路径必须具体。必须明确哪些部分是暂时不可检验的。
                </div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">C) Not in the main track (requires a separate track or not accepted)</div>
                <div className="text-sm text-zinc-500">C) 暂不进入主轨道。需要单独轨道或直接不收</div>
                <div className="text-sm text-zinc-400">- Clinical medicine and human-subject studies</div>
                <div className="text-sm text-zinc-400">- Any engineering proposals that may cause direct real-world risk</div>
                <div className="text-sm text-zinc-400">
                  Plain-language motivation: the ethics, compliance, and risk-management costs in these areas are too high and would dilute (or overwhelm) the
                  institutional focus of a theory-first platform.
                </div>
                <div className="text-sm text-zinc-500">- 医学临床与人体实验</div>
                <div className="text-sm text-zinc-500">- 任何可能造成现实世界直接风险的工程方案</div>
                <div className="text-sm text-zinc-500">
                  动机解释给外行听就是：这些领域的伦理、合规、风险管理成本太高，会拖垮理论平台的制度专注度。
                </div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">3.2 Article types: a minimal set for a theory platform.</div>
                <div className="text-sm text-zinc-500">3.2 Article Types 文章类型。理论平台建议的最小集合。</div>
                <div className="text-sm text-zinc-400">
                  We don’t start with an “anything goes” submission type. Make each type map 1:1 to its review standard.
                </div>
                <div className="text-sm text-zinc-500">我们一开始不做万能投稿：文章类型必须与审核标准一一对应。</div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">Minimal recommended set:</div>
                <div className="text-sm text-zinc-500">最小集合建议：</div>

                <div className="text-sm text-zinc-400">1. Theory Preprint — new theories, models, derivations</div>
                <div className="text-sm text-zinc-500">1. Theory Preprint — 新理论、新模型、新推导</div>
                <div className="text-sm text-zinc-400">2. Conjecture Note — conjectures, open problems, research agendas</div>
                <div className="text-sm text-zinc-500">2. Conjecture Note — 猜想、开放问题、研究议程</div>
                <div className="text-sm text-zinc-400">3. Proof or Formal Derivation — formal proofs, rigorous derivations, axiomatic systems</div>
                <div className="text-sm text-zinc-500">3. Proof or Formal Derivation — 严格证明、形式推导、公理体系</div>
                <div className="text-sm text-zinc-400">4. Computational Experiment — simulations, CA experiments, numerical exploration</div>
                <div className="text-sm text-zinc-500">4. Computational Experiment — 模拟、元胞自动机实验、数值探索</div>
                <div className="text-sm text-zinc-400">5. Verification Report — independent re-audit, formal verification, counterexample search</div>
                <div className="text-sm text-zinc-500">5. Verification Report — 独立复核推导、形式化验证、反例搜索报告</div>
                <div className="text-sm text-zinc-400">6. Replication Report — replicate others’ computational experiments or code pipelines</div>
                <div className="text-sm text-zinc-500">6. Replication Report — 复现他人计算实验或代码管线</div>
                <div className="text-sm text-zinc-400">7. Negative Result — failed paths + boundary conditions</div>
                <div className="text-sm text-zinc-500">7. Negative Result — 失败路径与边界条件，防止重复踩坑</div>
                <div className="text-sm text-zinc-400">8. Survey or Synthesis — surveys, maps, disputed-point comparisons</div>
                <div className="text-sm text-zinc-500">8. Survey or Synthesis — 综述、图谱、争议点对照表</div>
                <div className="text-sm text-zinc-400">9. Critique or Commentary — structured critique/addendum to a paper</div>
                <div className="text-sm text-zinc-500">9. Critique or Commentary — 对某篇论文的结构化批评或补充</div>

                <Separator className="bg-zinc-800" />

                <div className="text-sm text-zinc-400">
                  Motivation: article types are not meant to restrict expression. They tell readers what standard to use when reading, and tell reviewers what to
                  check.
                </div>
                <div className="text-sm text-zinc-500">
                  动机解释：文章类型不是为了限制表达，是为了让读者知道应该用什么标准读它。也为了让审核者知道应该检查什么。
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">CREDIBILITY / 可信度等级</div>
              <div className="text-sm text-zinc-400">4. Credibility levels: separate the right to exist from correctness.</div>
              <div className="text-sm text-zinc-500">4. 可信度等级体系。把存在权和正确性分开。</div>
              <div className="text-sm text-zinc-400">This is our academic core mechanism. We make it the product’s main visual.</div>
              <div className="text-sm text-zinc-500">这是我们的学术核心机制，我们会把它做成产品的主视觉。</div>

              <Separator className="bg-zinc-800" />

              <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                <div className="text-[11px] font-mono text-zinc-500">CORE_INVARIANT</div>
                <div className="text-lg font-mono text-emerald-400 tracking-tight">EXISTENCE ≠ CORRECTNESS</div>
                <div className="text-sm text-zinc-500">存在权 ≠ 正确性</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {([0, 1, 2, 3] as const).map((lvl) => {
                  const active = filters.minLevel === lvl;
                  const titleEn = lvl === 0 ? "Archived" : lvl === 1 ? "Policy Complete" : lvl === 2 ? "Open Reviewed" : "Verified";
                  const titleZh = lvl === 0 ? "已归档" : lvl === 1 ? "政策完整" : lvl === 2 ? "公开评审" : "已验证";
                  const bodyEn =
                    lvl === 0
                      ? "Passes baseline format and compliance checks. Exists publicly as a research record. Does not imply the conclusion is reliable."
                      : lvl === 1
                        ? "Passes scope review. Required structure is complete: claim list, assumption list, falsifiability path, related work. Author accountability and method/provenance disclosure are complete. Still does not imply correctness—only that it is readable, discussable, and re-auditable."
                        : lvl === 2
                          ? "At least 2 structured, template-compliant open reviews. Authors respond point-by-point and publish a revision (or explanation). Review records are citable."
                          : "For theory, we use Verified rather than Replicated. Upgrade if any independent audit passes: independent derivation re-audit, formal verification, third-party replication of computational experiments, or a key counterexample triggers a correction that then passes re-audit. Not a medal; it is a record whose process can take hits.";
                  const bodyZh =
                    lvl === 0
                      ? "通过基础格式与合规检查。作为研究记录公开存在。不代表结论可靠。"
                      : lvl === 1
                        ? "通过范围审查。必填结构齐全：主张清单、假设清单、可证伪路径、相关工作。作者责任与方法来源披露完整。依然不代表正确，只代表可读、可讨论、可复核。"
                        : lvl === 2
                          ? "至少 2 份符合模板的结构化公开评审；作者完成逐点回应并发布新版本（或给出解释）；评审记录可引用。"
                          : "理论类更推荐叫 Verified，而不是 Replicated。达成以下之一即可升级：独立推导复核通过、形式化系统验证通过、计算实验被第三方复现并报告一致、关键反例促成修正且修正版通过复核。Level 3 不是勋章，是过程经得起打的记录。";

                  return (
                    <button
                      key={`cred:${lvl}`}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, minLevel: prev.minLevel === lvl ? null : lvl }))}
                      className={
                        "group rounded-lg border px-3 py-3 text-left transition-colors " +
                        (active
                          ? "border-emerald-500/60 bg-emerald-950/20"
                          : "border-zinc-800 bg-black/20 hover:border-emerald-500/40 hover:bg-zinc-950/40")
                      }
                      aria-pressed={active}
                      aria-label={`Filter: Level ${lvl}+`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={active ? "emerald" : "muted"} className="font-mono text-[10px]">
                          LEVEL {lvl}
                        </Badge>
                        <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-500">{active ? "ACTIVE" : "FILTER"}</span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-200">{titleEn}</div>
                      <div className="text-sm text-zinc-500">{titleZh}</div>
                      <div className="mt-2 text-xs text-zinc-500 leading-relaxed">{bodyEn}</div>
                      <div className="text-xs text-zinc-600 leading-relaxed">{bodyZh}</div>
                    </button>
                  );
                })}
              </div>

              <Separator className="bg-zinc-800" />

              <div className="rounded-lg border border-zinc-800 bg-black/20 px-4 py-3 space-y-2">
                <div className="text-[11px] font-mono text-zinc-500">UPGRADE_CONSTRAINTS</div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-500">
                  <li>External AI reviews alone cannot trigger an upgrade from Level 1 → Level 2.</li>
                  <li>Every upgrade must link to a public audit object (review text, verification report, formal file, replication repo, etc.).</li>
                </ul>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600">
                  <li>外部 AI 审稿不能单独触发从 Level 1 升到 Level 2，避免形成“AI 写论文 + AI 审论文”的闭环。</li>
                  <li>任何 Level 升级必须能指向可公开的审查对象：评审文本、复核报告、形式化文件、复现仓库等。</li>
                </ul>
              </div>

              <div className="text-xs text-zinc-600 font-mono">
                Click a level to filter the archive below • 点击等级可筛选下方论文列表
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">SUBMISSION_GATES / 投稿闸门</div>
              <div className="text-sm text-zinc-400">5. Required submission fields: we gate on structure, not identity.</div>
              <div className="text-sm text-zinc-500">5. 投稿必填内容：我们不看人，看结构。</div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">Basic metadata (required)</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>Title</li>
                    <li>Structured abstract: Problem / Approach / Key Claims / Limitations</li>
                    <li>Article Type + Primary Discipline</li>
                    <li>Controlled Keywords (2–5) + Free Tags (0–10 optional)</li>
                    <li>License + Competing Interests + Funding (write “None” if none)</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: without these, readers cannot quickly tell what the paper is about or where the risks/limitations are.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">基础信息（必填）</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>Title</li>
                    <li>结构化摘要：Problem / Approach / Key Claims / Limitations</li>
                    <li>Article Type + Primary Discipline</li>
                    <li>Controlled Keywords（2–5）+ Free Tags（可选 0–10）</li>
                    <li>License + Competing Interests + Funding（无也要写 None）</li>
                  </ul>
                  <div className="text-xs text-zinc-600">动机：否则读者无法快速判断文章解决什么问题、风险在哪里。</div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">Theory tools (required): A) Claims List</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>Numbered as C1, C2, C3…</li>
                    <li>Each claim must point to a body paragraph reference or a proposition/theorem identifier</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: without a claims list, debate collapses into vibes and personal back-and-forth. Numbered claims make discussion precise.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">理论必填武器：A) 主张清单</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>编号 C1、C2、C3…</li>
                    <li>每条主张必须指向正文段落或命题编号</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：没有主张清单，争论永远变成感受对骂。主张清单让讨论可以精确落点。
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">Theory tools (required): B) Assumption Ledger</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>Assumption</li>
                    <li>Why needed</li>
                    <li>What would falsify it</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: theoretical disagreements usually come from implicit assumptions, not derivation technique. Making assumptions explicit is how we reach
                    consensus—or pinpoint the real root of disagreement.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">理论必填武器：B) 假设清单</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>Assumption</li>
                    <li>Why needed</li>
                    <li>What would falsify it</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：理论分歧往往不在推导技巧，而在隐含假设。把隐含假设拉到台面上，才有可能达成共识或找到分歧根源。
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">Theory tools (required): C) Falsifiability Path</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>At least one testable path</li>
                    <li>Real-world experiment / simulation prediction / formal counterexample search</li>
                    <li>If currently untestable: state dependency conditions + future test trigger</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: a falsifiability path is not meant to reject bold theories—it turns a theory from belief into a research plan.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">理论必填武器：C) 可证伪路径</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>至少一条可检验路径</li>
                    <li>现实实验 / 模拟预测 / 形式化反例搜索</li>
                    <li>若目前不可检验：写清依赖条件 + 未来可检验触发点</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：可证伪路径不是为了否定大胆理论，而是为了让理论从信仰变成研究计划。
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">5.3 Relation to Prior Work (required)</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>At least 5 references</li>
                    <li>For each: inherits/builds on, conflicts with, differs from</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: citations are not decoration. They prove a work is not invented in a vacuum and help readers locate it on the map.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">5.3 相关工作与对齐（必填）</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>至少 5 条相关文献</li>
                    <li>并说明：继承点、冲突点、差异点</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：外行可能觉得引用是装饰。学术上引用是对“研究不是凭空发明”的最基本证明，也能让读者把它定位在知识地图上。
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">5.4 Provenance and Tooling Statement (required)</div>
                  <div className="text-xs text-zinc-600">
                    Do not call this “AI Disclosure”. The form should be a neutral description, not a moral judgment.
                  </div>
                  <div className="text-xs text-zinc-600">
                    Motivation (plain terms): we don’t care which tools were used; we care whether critical tool-influenced outputs were verified—like engineering requires dependency declarations and test reports.
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>
                      A) Tooling Checklist (multi-select): Writing/editing; Code generation in final pipeline; Data generation/synthetic evidence; Theorem/proof search; Citation/literature assistance; None
                    </li>
                    <li>
                      B) Validation Note (conditional): required when tooling affects conclusions; describe how outputs were validated (recompute, cross-validate, proof-check, reproduce, manual step review, baseline comparisons)
                    </li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">5.4 方法与来源披露（必填）</div>
                  <div className="text-xs text-zinc-600">不要叫 AI Disclosure。表单应该是中性描述，不是审判。</div>
                  <div className="text-xs text-zinc-600">
                    动机解释（给外行）：我们不是关心用了什么工具，我们关心工具参与生成的关键内容有没有被验证过。就像工程里必须写依赖和测试报告。
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>
                      A) 工具清单（多选）：写作/编辑辅助；最终管线代码生成；作为证据的数据生成/合成；定理/证明搜索辅助；自动化引用/文献辅助；无
                    </li>
                    <li>
                      B) 复核说明（条件必填）：当工具会影响结论时必填；写清如何验证输出（复算、交叉验证、形式化证明检查、复现实验、人工逐步审阅、对照基准等）
                    </li>
                  </ul>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">5.5 Authors & Responsible Steward (required)</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>Authors list</li>
                    <li>Responsible Steward: at least one accountable human/organization</li>
                    <li>Contributor Roles (CRediT-style): Conceptualization, Methodology, Software, Validation, Writing, Visualization (assign at least one)</li>
                    <li>Non-human contributors module: model/agent name, version/id, scope, prompt/params summary, validation summary</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: keep AI contributions visible without putting them in the author line and triggering ethics debates.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">5.5 作者与责任主体（必填）</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>Authors 列表</li>
                    <li>Responsible Steward：至少 1 位责任主体（人/组织）</li>
                    <li>Contributor Roles（贡献角色）：Conceptualization、Methodology、Software、Validation、Writing、Visualization（至少填写 1 个）</li>
                    <li>非人类贡献者模块：模型/代理名称、版本/标识、用途范围、提示/参数摘要、验证方式摘要</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：既保留 AI 贡献的可见性，也不在作者行制造伦理争议。
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">6. Dual Channels: Comments vs Reviews</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                    <li>
                      Comments: typed discussion (Question/Suggestion/Reference/Concern/Counterexample); Suggestion/Concern/Counterexample cite C1 or a paragraph anchor; author replies tagged; soft-hide folding (no deletion); can be marked Resolved/Incorporated
                    </li>
                    <li>
                      Reviews: required template (summary, strengths, concerns, falsifiability, technical correctness, verification readiness, requested changes, recommendation). Avoid Accept/Reject; use “Eligible for Level 2 after …”. Reviews are citeable objects with hash + timestamp, reviewer identity or anonymous choice, and a COI statement.
                    </li>
                    <li>AI Audit Line: AI reports are audit tools (risk signals + re-checkable checks) and do not directly decide Level upgrades.</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    Motivation: if reviews become a comment section, the loudest wins. Structure encodes standards so discussion can be reused.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-zinc-500">6. 审稿与讨论双通道：Comments vs Reviews</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                    <li>Comments（讨论）：强制类型（Question/Suggestion/Reference/Concern/Counterexample）；建议/疑虑/反例需引用 C1 或段落锚点；作者回复带 Author 标签；低质不违规折叠不删评；可标记 Resolved/Incorporated</li>
                    <li>
                      Reviews（评审）：评审模板必填（贡献摘要/优势/疑虑/可证伪性/技术正确性/复核就绪度/修改请求/建议）。不建议 Accept/Reject；建议用“Eligible for Level 2 after …”。评审作为对象可引用（哈希+时间戳），支持身份/匿名选择，并强制利益冲突声明（None 也要写）。
                    </li>
                    <li>AI 审计线：AI 报告是审计工具（风险信号 + 可复核检查），不直接决定 Level 升级。</li>
                  </ul>
                  <div className="text-xs text-zinc-600">
                    动机解释：如果把评审做成评论区，最后只剩声量大的人赢。结构化评审把质量标准写进文本，让讨论可以复用。
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">AI_AUDIT / AI 审计</div>
              <div className="text-sm text-zinc-400">7. AI Audit Standards: AI is not the judge.</div>
              <div className="text-sm text-zinc-500">7. AI 审稿标准：AI 不是裁判，AI 是审计工具。</div>
              <div className="text-xs text-zinc-600">
                AI reports exist to make review auditable and structured. They do not decide acceptance; they surface missing structure, re-checkable checks, and
                risk signals for humans to act on.
              </div>
              <div className="text-xs text-zinc-600">
                AI 报告的目标是让审查可审计、可结构化；它不替代学术裁决，只提供缺失项、可复核检查与风险信号，供人类评审线处理。
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">7.2 Seven-module AI audit report (per paper)</div>
                <div className="text-sm text-zinc-500">7.2 AI 审计 7 模块（每篇论文生成一份报告）</div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-500">
                  <li>Completeness Check：claims / assumptions / falsifiability path / related work / disclosures.</li>
                  <li>Claim Extraction & Traceability：C1..Cn + SOURCE_REF + evidence pointers (fig/table/data/code/DOI/hash).</li>
                  <li>Assumption Consistency：hidden assumptions list (ledger gaps).</li>
                  <li>Citation Integrity：format/DOI structure/existence (best-effort) + mismatch risk (risk-only).</li>
                  <li>Symbol & Logic Heuristics：symbol consistency / variable conflicts / derivation-jump cues (explicitly heuristic).</li>
                  <li>Reproducibility Readiness：version pinning + params/seeds + runbook checklist.</li>
                  <li>Paper-mill & Abuse Signals：templated/repetitive patterns + abnormal citations; human-review trigger only.</li>
                </ul>
                <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                  <li>完整性检查：主张/假设/可证伪路径/相关工作/披露声明。</li>
                  <li>主张抽取与可追溯性：C1..Cn + SOURCE_REF + 证据指针（图表/数据/代码/DOI/哈希）。</li>
                  <li>假设一致性：输出“隐含假设”清单（对齐假设账本缺口）。</li>
                  <li>引用完整性：格式/DOI 结构/存在性（尽力确认）+ 不匹配风险（仅风险信号）。</li>
                  <li>符号与逻辑启发式体检：符号一致/变量冲突/推导跳步提示（明确启发式）。</li>
                  <li>复现就绪度：版本锁定 + 参数/seed + 运行说明 checklist。</li>
                  <li>版式化与滥用信号：模板化/重复段落/异常引用；仅触发人工复核。</li>
                </ul>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-2">
                <div className="text-sm text-zinc-400">7.3 Confidentiality & boundaries</div>
                <div className="text-sm text-zinc-500">7.3 保密与边界</div>
                <div className="text-xs text-zinc-600">
                  Do not freely send unpublished manuscripts to external model services during review. Prefer built-in audit pipelines, or require explicit author authorization
                  before any external processing.
                </div>
                <div className="text-xs text-zinc-600">评审过程不得把未公开稿件随意输入外部模型服务。应优先使用平台内置审计管线；如需外部处理，必须要求作者明确授权。</div>
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">CURATION / 学术策展</div>
              <div className="text-sm text-zinc-400">8. External review importing & credit allocation</div>
              <div className="text-sm text-zinc-500">8. 外部审稿搬运与信用分配：把搬运升级成学术策展</div>
              <div className="text-xs text-zinc-600">
                External reviews already exist across blogs/forums/PubPeer/GitHub/social. Omega treats importing as curation: structured, attributed, claim-mapped
                review objects that can be reused and cited.
              </div>
              <div className="text-xs text-zinc-600">
                外部审稿早已散落在各处。Omega 把“搬运”定义为学术策展：结构化 + 归因 + 与编号主张对齐，让外部审稿变成可复用、可引用的公共资产。
              </div>
              <div className="text-xs text-zinc-600">
                Motivation: external AI reviews can surface issues, but do not replace community/editor accountability. Safety: link-over-copy by default; rewards/credits settle only
                for validated effective curation to prevent spam farming.
              </div>
              <div className="text-xs text-zinc-600">动机解释：外部 AI 审稿能帮助发现问题，但不能替代社区与编辑的责任。安全边界：默认只存链接；摘录需许可证/授权；奖励/信用只对有效策展且经复核后结算，防刷量。</div>

              <Separator className="bg-zinc-800" />

              <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600">
                <li>Attribution-first：source URL + 原作者/时间戳/平台标签必填。</li>
                <li>Link-over-copy：默认只保存链接 + 策展摘要；全文镜像需许可证/授权，避免版权风险。</li>
                <li>Token gated：采用 Snapshot + Attestation（签名声明 + 哈希），并提供下架通道（权利人/系统方可请求移除）。</li>
                <li>External Review Artifact：外部审稿以独立对象导入（source + 署名/归因 + 哈希 + 审核状态 + 撤回/下架记录），而不是普通评论。</li>
                <li>No meaning drift：引用要原文标注；摘要要标注为 curated summary。</li>
                <li>Credit allocation：支持多角色归因（评审生成者 / 系统创建者 / 策展者 / 翻译/主张映射/引文核对）；系统创建者拿的是 System Creator credit，不是这条 review 的 author credit。</li>
                <li>Unclaimed profile：允许为外部名人/系统创建者创建未认领 profile，公开展示来源链接与归因说明，未来可认领（不要求先注册才能给 credit）。</li>
                <li>Level 影响：External reviews 默认不触发升级；仅当 Verified Reviewer 复核确认或编辑标记 High-signal，且作者完成回应与版本更新时，才可作为升级条件的一部分。</li>
                <li>奖励分解：四层贡献点（基础导入分、结构化整理加分、主张映射加分、社区验证加分）；基础导入分需审核通过，社区验证加分需 helpful + addressed + high-signal。</li>
              </ul>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">TIERED_PERMISSIONS / 分层权限</div>
              <div className="text-sm text-zinc-400">9.2 Tiered permissions: anti-spam + quality without black-box deletion.</div>
              <div className="text-sm text-zinc-500">9.2 分层权限：在不黑箱删帖的前提下做反刷与讨论质量控制。</div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600">
                <li>New accounts: comments are queued (visible to the commenter + editors only). / 新账号：评论进入队列（仅本人 + 编辑可见）。</li>
                <li>Editors can approve/remove with reason codes; all actions are logged in Governance. / 编辑可通过/移除并选择理由代码；所有动作写入 Governance 治理日志。</li>
                <li>High-rep users can help mark spam and merge duplicates; can request evidence (logged). / 高信誉可协助标记垃圾与合并重复；可要求补证据（写日志）。</li>
                <li>Reviewer tier can publish structured reviews (COI required; anonymous allowed). / 审稿人权限可发布结构化评审（必填 COI；支持匿名）。</li>
              </ul>
              <div className="text-xs text-zinc-600">
                Demo: set tiers in the Comments/Reviews composer; queued comments can be approved/removed by editors. / Demo：在 Comments/Reviews 表单里设置账户等级；队列评论由编辑通过或移除。
              </div>
            </div>

            <div className="border border-zinc-800 bg-black/20 p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-500">INCENTIVES / 激励</div>
              <div className="text-sm text-zinc-400">10. Incentives: don’t reward “taking sides”, reward verification.</div>
              <div className="text-sm text-zinc-500">10. 激励体系：不奖励“站队”，要奖励验证。</div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600">
                <li>Validators earn only after random audit passes (anti-cheat). / 验证者奖励需随机审计通过后才结算（反作弊）。</li>
                <li>Authors claim after defense pass + evidence coverage + ≥1 verified ticket. / 作者需通过对抗式辩护 + 证据覆盖 + ≥1 已验证工单才可领取。</li>
                <li>Curator credit settles in layers: approval → normalization → claim mapping → community validation. / 策展信用分层结算：审核通过 → 结构化整理 → 主张映射 → 社区验证。</li>
                <li>
                  Reputation is the currency: profile contribution graph + badges (Proof Checker / Replication Engineer / …) — see <span className="font-mono text-zinc-300">/profile</span>.
                  / 声望是货币：贡献图谱 + 徽章体系（Proof Checker / Replication Engineer / …）— 见 <span className="font-mono text-zinc-300">/profile</span>。
                </li>
              </ul>
              <div className="text-xs text-zinc-600">
                Demo-only economy: no real token or wallet integration. / Demo 仅模拟经济：无真实代币与钱包集成。
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

            <details className="border border-zinc-800 bg-black/20 p-5">
              <summary className="cursor-pointer select-none list-none">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-emerald-500">PLAN_CONTINUATION / 计划续篇</div>
                    <div className="text-sm text-zinc-200">10.2–18: Bounties • Corrections • Policies • Object Model • Flow</div>
                    <div className="text-sm text-zinc-500">10.2–18：赏金 • 纠错撤稿 • 政策集合 • 对象模型 • 端到端流程</div>
                  </div>
                  <div className="text-xs font-mono text-zinc-600">CLICK_TO_EXPAND</div>
                </div>
              </summary>

              <div className="mt-4 space-y-4 text-xs text-zinc-600">
                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">10.2 BOUNTIES / 赏金</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Verifiable tasks only (not “buying conclusions”). / 只买可验收的验证劳动（不是买结论）。</li>
                    <li>
                      Task types: derivation verification, counterexample search, Lean/Coq formalization, simulation reproduction, ablations/benchmarks, literature synthesis maps. / 类型：推导复核、反例搜索、形式化、模拟复现、消融基准、文献图谱。
                    </li>
                    <li>
                      Required fields: Objective, Deliverable, Acceptance criteria, Review committee, Deadline+payout, COI. / 必填：目标、交付物、验收标准、验收委员会、截止+支付规则、COI。
                    </li>
                  </ul>
                  <div className="text-xs text-zinc-500">
                    Demo entry: <span className="font-mono text-zinc-300">/market</span> (audit-weighted payout simulation). / Demo：
                    <span className="font-mono text-zinc-300">/market</span>（随机审计后结算）。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">11 CORRECTIONS / 纠错撤稿</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Status ladder: Minor correction / Major correction / Expression of concern / Retraction. / 四状态：小更正/大更正/关注声明/撤稿。</li>
                    <li>Retraction keeps the record + rationale (no silent deletion). / 撤稿保留记录与理由，不能删库。</li>
                    <li>Dispute convergence: mark Contested → invite verification bounty → require author v2 response. / 争议收敛：Contested 标记→邀请验证赏金→作者 v2 回应。</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">12 POLICIES / 政策集合</div>
                  <div className="text-xs text-zinc-500">
                    8 policies bind to product gates (scope, provenance, open review norms, AI audit protocol, data/code availability, ethics+COI, disputes+corrections, external review import). / 8 份政策绑定到产品闸门（范围、来源、公开评审、AI 审计、数据代码、伦理 COI、争议纠错、外部审稿导入）。
                  </div>
                  <div className="text-xs text-zinc-500">
                    See: <span className="font-mono text-zinc-300">/policies</span> / 见：<span className="font-mono text-zinc-300">/policies</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">13 OBJECT MODEL / 对象模型</div>
                  <div className="text-xs text-zinc-500">
                    Core objects: Paper, PaperVersion, Claim, Assumption, FalsifiabilityPath, AIAuditReport, Review, Comment, Verification/ReplicationReport, ExternalReviewArtifact, Bounty, ReputationEvent, ModerationLog, PolicyDocument, Collection.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">14 FLOW / 端到端流程</div>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Import (Zenodo) or new submission. / 导入（Zenodo）或新投稿。</li>
                    <li>Gate 0: automatic checks + AI audit v0. / Gate 0：自动检查 + AI 审计 v0。</li>
                    <li>Gate 1: editor scope + structure check → Level 0/1 publish. / Gate 1：范围+结构审查→Level 0/1 发布。</li>
                    <li>Public layer: comments + qualified reviews + external review import. / 发布后：评论+合格评审+外部审稿导入。</li>
                    <li>Review → author response → version iteration. / 评审→作者回应→版本迭代。</li>
                    <li>Level upgrades: Level 2 by structured reviews; Level 3 by verification artifacts. / Level 升级：Level 2 由结构化评审；Level 3 由验证产物。</li>
                    <li>Corrections/retractions with traceable logs. / 纠错撤稿全程可追踪。</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">15 ROADMAP / 路线图</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Stage A: collections, claim mapper, audit logs, citeable reviews, external import tools. / A：策展集、主张映射、审计日志、可引用评审、导入工具。</li>
                    <li>Stage B: formal verification track, counterexample board, simulation sandbox, reviewer ladder. / B：形式化轨道、反例板、复现实验沙箱、评审声望阶梯。</li>
                    <li>Stage C: grant governance, on-chain attestations (fingerprints only), community juries. / C：资助治理、链上存证（只存指纹）、社区仲裁团。</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">16 FAQ / 动机图谱</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Claims/assumptions/falsifiability are required so disputes converge. / 主张/假设/可证伪是为了让争论可收敛。</li>
                    <li>Tool-neutral ≠ provenance-free: record tooling for re-audit, not moral judgment. / 工具中立≠不记录来源；记录是为了复核而非审判。</li>
                    <li>Separate comments vs reviews; reward verification over opinions. / 评论与评审分流；奖励验证不奖励站队。</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">17 MANIFESTO / 学术宣言</div>
                  <div className="text-xs text-zinc-500">
                    Omega does not decide truth by identity; it accumulates trust via an auditable chain (claims → assumptions → evidence → derivations → versions → reviews → verification → corrections). / Omega 不以身份定真伪，而以可审计链条累积可信度。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-500">18 NEXT / 下一步</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Scope & Article Types v0.1</li>
                    <li>Provenance + Tooling Statement + AI Audit Protocol v0.1</li>
                    <li>External Review Import & Attribution v0.1</li>
                  </ul>
                </div>
              </div>
            </details>

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
