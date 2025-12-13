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
                  stages. Traditional journals tend to dislike high-variance work. Omega should attract precisely the people filtered out by that system. Without
                  credibility stratification, high-variance exploration becomes noise; readers will experience it as mysticism.
                </div>
                <div className="text-sm text-zinc-500">
                  高方差探索的意思是：允许大胆假设。允许与主流不同。允许在早期很不成熟。传统期刊往往不喜欢高方差。你们要吸引的就是被这个系统排斥的人。但如果没有可信度分层，高方差就会变成噪音。读者会觉得全是玄学。
                </div>
                <div className="text-sm text-zinc-400">
                  Platform strategy: use credibility levels to carry high variance. Level 0 may exist. Level 1 requires a complete structure. Level 2 requires open
                  review. Level 3 requires independent replication or verification. Omega never promises Level 0 or Level 1 conclusions are correct—it only promises
                  the record is complete and traceable.
                </div>
                <div className="text-sm text-zinc-500">
                  对应平台策略是：用可信度等级来承载高方差。Level 0 允许存在。Level 1 要求结构完整。Level 2 需要公开评审。Level 3 需要独立复核或验证。平台从不承诺 Level 0 或 Level 1 的结论正确。平台只承诺记录完整可追溯。
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
                <div className="text-sm text-zinc-500">不 judge 的意思是：不因为你是 AI 写的就否定。也不因为你是名校教授就加分。</div>
                <div className="text-sm text-zinc-400">
                  But an academic system needs two non-negotiable baselines: a responsible party and method provenance. Without them, errors cannot be corrected and
                  disputes cannot converge.
                </div>
                <div className="text-sm text-zinc-500">但学术系统必须有两个底线：责任主体。方法来源。否则任何错误都没法纠正，任何争议都没法收敛。</div>
                <div className="text-sm text-zinc-400">
                  Platform strategy: Omega does not run an AI morality court. We do method and provenance disclosure. If a tool or automated workflow affects the
                  derivation, code, data, conclusions, or figures, it is part of the methodology and must be recorded. The goal is re-audit, not labeling.
                </div>
                <div className="text-sm text-zinc-500">
                  对应平台策略是：你们不做 AI 道德审判。你们做方法与来源披露。只要某种工具或自动化流程影响了推导、代码、数据、结论或图表，它就属于方法学的一部分，必须记录，目的是复核，不是贴标签。
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
