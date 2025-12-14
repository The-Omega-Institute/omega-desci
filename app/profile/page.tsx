"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Comment, Review, ExternalReviewArtifact } from "@/lib/mockData";
import type { WorkOrdersStoreV1, WorkOrderV1 } from "@/lib/review/verification";
import type { AccountTier } from "@/lib/identity";
import { formatAccountTier, handleKey, loadActorTiers, persistActorTiers } from "@/lib/identity";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from "@/components/ui/shadcn";
import { Award, BarChart3, ExternalLink, User } from "lucide-react";

const ACTIVE_HANDLE_KEY = "omega_profile_active_handle_v1";

type TimelineBucket = { month: string; count: number };

type ReputationSignals = {
  reviewsAddressed: number;
  keyCounterexamplesConfirmed: number;
  keyCitationsConfirmed: number;
  verificationPassesConfirmed: number;
  replicationPassesConfirmed: number;
  literatureMappingAdopted: number;
  externalClaimMappingRecognized: number;
};

type ContributionCounts = {
  commentsPosted: number;
  repliesPosted: number;
  reviewsPosted: number;
  externalReviewsCurated: number;
  externalReviewsClaimMapped: number;
  workOrdersPassed: number;
  auditsConfirmed: number;
};

type BadgeSpec = {
  id: string;
  name: string;
  nameZh: string;
  achieved: boolean;
  criteriaEn: string;
  criteriaZh: string;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeHandle(input: string) {
  return String(input || "").trim();
}

function sameHandle(a: string, b: string) {
  const ak = handleKey(a);
  const bk = handleKey(b);
  return Boolean(ak) && ak === bk;
}

function monthKey(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  if (!Number.isFinite(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function lastNMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  const y0 = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - i, 1));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${yyyy}-${mm}`);
  }
  return out;
}

function extractComments(raw: unknown): Comment[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return [];
  const comments = obj.comments;
  return Array.isArray(comments) ? (comments as Comment[]) : [];
}

function extractReviews(raw: unknown): Review[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1 && obj.version !== 2) return [];
  const reviews = obj.reviews;
  return Array.isArray(reviews) ? (reviews as Review[]) : [];
}

function extractExternalArtifacts(raw: unknown): ExternalReviewArtifact[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return [];
  const artifacts = obj.artifacts;
  return Array.isArray(artifacts) ? (artifacts as ExternalReviewArtifact[]) : [];
}

function extractWorkOrders(raw: unknown): WorkOrdersStoreV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<WorkOrdersStoreV1>;
  if (obj.version !== 1) return null;
  if (typeof obj.paperId !== "string") return null;
  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
    paperId: obj.paperId,
    orders: Array.isArray(obj.orders) ? (obj.orders as WorkOrderV1[]) : [],
    ledger: Array.isArray(obj.ledger) ? (obj.ledger as WorkOrdersStoreV1["ledger"]) : [],
  };
}

function scanKnownHandlesFromLocalStorage(): string[] {
  if (typeof window === "undefined") return [];
  let keys: string[] = [];
  try {
    keys = Object.keys(window.localStorage);
  } catch {
    return [];
  }

  const handles = new Set<string>();

  const add = (h: unknown) => {
    const v = normalizeHandle(String(h || ""));
    if (!v) return;
    if (v.length > 64) return;
    handles.add(v);
  };

  // Known profile stores.
  const validatorStore = safeParseJson<{ version?: unknown; profilesByHandle?: Record<string, unknown> }>(window.localStorage.getItem("omega_validator_profiles_v1"));
  if (validatorStore?.profilesByHandle && typeof validatorStore.profilesByHandle === "object") {
    for (const k of Object.keys(validatorStore.profilesByHandle)) add(k);
  }

  const authorStore = safeParseJson<{ version?: unknown; profilesByHandle?: Record<string, unknown> }>(window.localStorage.getItem("omega_author_profiles_v1"));
  if (authorStore?.profilesByHandle && typeof authorStore.profilesByHandle === "object") {
    for (const k of Object.keys(authorStore.profilesByHandle)) add(k);
  }

  const actorTiers = loadActorTiers();
  for (const k of Object.keys(actorTiers)) add(k);

  // Paper-scoped stores.
  for (const key of keys) {
    if (key.startsWith("omega_comments_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const comments = extractComments(parsed);
      for (const c of comments) {
        add(c.author);
        for (const r of c.replies || []) add(r.author);
      }
    } else if (key.startsWith("omega_reviews_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const reviews = extractReviews(parsed);
      for (const r of reviews) {
        if (r.anonymous) continue;
        add(r.author);
      }
    } else if (key.startsWith("omega_external_review_artifacts_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const artifacts = extractExternalArtifacts(parsed);
      for (const a of artifacts) {
        add(a.curator?.userId);
        for (const v of a.validation?.helpfulVotes || []) add(v.by);
        add(a.validation?.addressed?.addressedBy);
        add(a.validation?.highSignal?.markedBy);
      }
    } else if (key.startsWith("omega_work_orders_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const store = extractWorkOrders(parsed);
      if (!store) continue;
      for (const o of store.orders) {
        add(o.claimedBy);
        add(o.lastAttempt?.by);
        add(o.audit?.claimedBy);
      }
    }
  }

  return Array.from(handles.values()).sort((a, b) => a.localeCompare(b));
}

function computeProfile(handle: string) {
  if (typeof window === "undefined") {
    return {
      counts: {
        commentsPosted: 0,
        repliesPosted: 0,
        reviewsPosted: 0,
        externalReviewsCurated: 0,
        externalReviewsClaimMapped: 0,
        workOrdersPassed: 0,
        auditsConfirmed: 0,
      } satisfies ContributionCounts,
      signals: {
        reviewsAddressed: 0,
        keyCounterexamplesConfirmed: 0,
        keyCitationsConfirmed: 0,
        verificationPassesConfirmed: 0,
        replicationPassesConfirmed: 0,
        literatureMappingAdopted: 0,
        externalClaimMappingRecognized: 0,
      } satisfies ReputationSignals,
      timeline: [] as TimelineBucket[],
      badges: [] as BadgeSpec[],
    };
  }

  let keys: string[] = [];
  try {
    keys = Object.keys(window.localStorage);
  } catch {
    keys = [];
  }

  const counts: ContributionCounts = {
    commentsPosted: 0,
    repliesPosted: 0,
    reviewsPosted: 0,
    externalReviewsCurated: 0,
    externalReviewsClaimMapped: 0,
    workOrdersPassed: 0,
    auditsConfirmed: 0,
  };

  const signals: ReputationSignals = {
    reviewsAddressed: 0,
    keyCounterexamplesConfirmed: 0,
    keyCitationsConfirmed: 0,
    verificationPassesConfirmed: 0,
    replicationPassesConfirmed: 0,
    literatureMappingAdopted: 0,
    externalClaimMappingRecognized: 0,
  };

  const eventsByMonth = new Map<string, number>();
  const bump = (at: string | undefined | null) => {
    if (!at) return;
    const m = monthKey(at);
    if (!m) return;
    eventsByMonth.set(m, (eventsByMonth.get(m) || 0) + 1);
  };

  for (const key of keys) {
    if (key.startsWith("omega_comments_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const comments = extractComments(parsed);
      for (const c of comments) {
        if (sameHandle(c.author, handle)) {
          counts.commentsPosted += 1;
          bump(c.createdAt);
          const kind = c.kind;
          if ((kind === "counterexample" || kind === "reference") && (c.status === "resolved" || c.status === "incorporated")) {
            if (kind === "counterexample") signals.keyCounterexamplesConfirmed += 1;
            if (kind === "reference") {
              signals.keyCitationsConfirmed += 1;
              signals.literatureMappingAdopted += 1;
            }
          }
        }
        for (const r of c.replies || []) {
          if (!sameHandle(r.author, handle)) continue;
          counts.repliesPosted += 1;
          bump(r.createdAt);
        }
      }
    } else if (key.startsWith("omega_reviews_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const reviews = extractReviews(parsed);
      for (const r of reviews) {
        if (r.anonymous) continue;
        if (!sameHandle(r.author, handle)) continue;
        counts.reviewsPosted += 1;
        bump(r.createdAt);
        if (r.addressed) {
          signals.reviewsAddressed += 1;
          bump(r.addressed.addressedAt);
        }
      }
    } else if (key.startsWith("omega_external_review_artifacts_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const artifacts = extractExternalArtifacts(parsed);
      for (const a of artifacts) {
        if (!sameHandle(a.curator?.userId || "", handle)) continue;
        counts.externalReviewsCurated += 1;
        bump(a.createdAt);
        const mappedTargets = (a.curator?.mappedTargets || []).filter(Boolean);
        if (mappedTargets.length) counts.externalReviewsClaimMapped += 1;

        const helpful = (a.validation?.helpfulVotes || []).length > 0;
        const addressed = Boolean(a.validation?.addressed);
        const highSignal = Boolean(a.validation?.highSignal);
        if (mappedTargets.length && helpful && addressed && highSignal) {
          signals.externalClaimMappingRecognized += 1;
        }
      }
    } else if (key.startsWith("omega_work_orders_v1:")) {
      const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
      const store = extractWorkOrders(parsed);
      if (!store) continue;
      for (const o of store.orders) {
        const passedByYou = o.status === "passed" && o.lastAttempt && sameHandle(o.lastAttempt.by, handle);
        if (passedByYou) {
          counts.workOrdersPassed += 1;
          signals.verificationPassesConfirmed += 1;
          bump(o.lastAttempt?.at);
        }
        const auditedByYou = o.audit?.status === "confirmed" && sameHandle(o.audit?.claimedBy || "", handle);
        if (auditedByYou) {
          counts.auditsConfirmed += 1;
          bump(o.audit?.decidedAt);
        }
      }
    }
  }

  // Demo: split "verification" vs "replication" by whether a paper has a replication bounty.
  // (Without a backend, we treat both as confirmed checkable work.)
  signals.replicationPassesConfirmed = signals.verificationPassesConfirmed;

  const months = lastNMonths(12);
  const timeline: TimelineBucket[] = months.map((m) => ({ month: m, count: eventsByMonth.get(m) || 0 }));

  const badgeSpecs: BadgeSpec[] = [
    {
      id: "proof-checker",
      name: "Proof Checker",
      nameZh: "Proof Checker（证明核对者）",
      achieved: signals.keyCounterexamplesConfirmed >= 1 || signals.reviewsAddressed >= 1,
      criteriaEn: "Earn ≥1 confirmed counterexample OR ≥1 addressed review.",
      criteriaZh: "获得 ≥1 被确认的反例 或 ≥1 被标记 Addressed 的评审。",
    },
    {
      id: "replication-engineer",
      name: "Replication Engineer",
      nameZh: "Replication Engineer（复现工程师）",
      achieved: counts.workOrdersPassed >= 2 || counts.auditsConfirmed >= 1,
      criteriaEn: "Pass ≥2 tickets OR confirm ≥1 audit.",
      criteriaZh: "通过 ≥2 工单 或 确认 ≥1 次审计。",
    },
    {
      id: "literature-curator",
      name: "Literature Curator",
      nameZh: "Literature Curator（文献策展）",
      achieved: signals.literatureMappingAdopted >= 2 || counts.externalReviewsCurated >= 2,
      criteriaEn: "Have ≥2 adopted citation/literature mappings OR curate ≥2 external reviews.",
      criteriaZh: "≥2 条被采纳的引用/文献映射，或策展 ≥2 条外部审稿。",
    },
    {
      id: "reviewer-l3",
      name: "Reviewer Level 3",
      nameZh: "Reviewer Level 3（审稿人 Lv3）",
      achieved: counts.reviewsPosted >= 3 && signals.reviewsAddressed >= 1,
      criteriaEn: "Post ≥3 reviews AND have ≥1 marked Addressed.",
      criteriaZh: "发布 ≥3 份评审，且至少 1 份被标记 Addressed。",
    },
    {
      id: "external-review-curator",
      name: "External Review Curator",
      nameZh: "External Review Curator（外部审稿策展）",
      achieved: counts.externalReviewsCurated >= 1 && signals.externalClaimMappingRecognized >= 1,
      criteriaEn: "Curate ≥1 external review AND have ≥1 recognized claim mapping.",
      criteriaZh: "策展 ≥1 条外部审稿，且至少 1 条 claim mapping 被认可。",
    },
  ];

  return { counts, signals, timeline, badges: badgeSpecs };
}

export default function ProfilePage() {
  const [handles, setHandles] = useState<string[]>([]);
  const [activeHandle, setActiveHandle] = useState("You");
  const [actorTiers, setActorTiers] = useState<Record<string, AccountTier>>({});

  useEffect(() => {
    setHandles(scanKnownHandlesFromLocalStorage());
    setActorTiers(loadActorTiers());
    const saved = safeParseJson<{ handle?: unknown }>(typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_HANDLE_KEY) : null);
    const savedHandle = normalizeHandle(typeof saved?.handle === "string" ? saved.handle : "");
    if (savedHandle) setActiveHandle(savedHandle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ACTIVE_HANDLE_KEY, JSON.stringify({ version: 1, handle: activeHandle, updatedAt: new Date().toISOString() }));
    } catch {
      // ignore
    }
  }, [activeHandle]);

  useEffect(() => {
    persistActorTiers(actorTiers);
  }, [actorTiers]);

  const tier: AccountTier = useMemo(() => {
    const k = handleKey(activeHandle);
    return (k && actorTiers[k]) || "new";
  }, [actorTiers, activeHandle]);

  const profile = useMemo(() => computeProfile(activeHandle), [activeHandle]);

  const maxTimeline = useMemo(() => {
    const max = Math.max(0, ...profile.timeline.map((b) => b.count));
    return max || 1;
  }, [profile.timeline]);

  const setTier = (next: AccountTier) => {
    const k = handleKey(activeHandle);
    if (!k) return;
    setActorTiers((prev) => ({ ...prev, [k]: next }));
  };

  return (
    <div className="container py-10 px-4 md:px-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="text-[10px] font-mono text-zinc-600">PROFILE / REPUTATION</div>
          <h1 className="text-3xl font-serif text-white">Reputation Profile / 声望档案</h1>
          <p className="text-sm text-zinc-500">
            EN: Reputation is bound to verification work (tickets, audits, confirmed counterexamples/citations), not conclusion stance.
            <br />
            中文：声望绑定“验证工作”（工单、审计、被确认的反例/引用），而不是结论立场。
          </p>
        </div>
        <Link href="/policies">
          <Button variant="outline" className="border-zinc-700 text-zinc-300">
            Policies <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <Card className="bg-black/20">
        <CardHeader className="space-y-2">
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-500" /> Identity
          </CardTitle>
          <div className="text-xs text-zinc-500">
            Demo-only: identities are local handles (no wallet binding). / Demo：身份为本地 handle（无钱包绑定）。
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-600">HANDLE</div>
              <Input value={activeHandle} onChange={(e) => setActiveHandle(e.target.value)} placeholder="e.g. lab42" />
              {handles.length ? (
                <div className="flex flex-wrap gap-2">
                  {handles.slice(0, 12).map((h) => (
                    <Button
                      key={h}
                      size="sm"
                      variant={sameHandle(h, activeHandle) ? "emerald" : "outline"}
                      className={sameHandle(h, activeHandle) ? undefined : "border-zinc-700"}
                      onClick={() => setActiveHandle(h)}
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-600">No handles detected yet. Create activity in /submit, /market, or paper drawer.</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-600">ACCOUNT_TIER</div>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as AccountTier)}
                className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="new">{formatAccountTier("new")}</option>
                <option value="established">{formatAccountTier("established")}</option>
                <option value="high_reputation">{formatAccountTier("high_reputation")}</option>
                <option value="reviewer">{formatAccountTier("reviewer")}</option>
              </select>
              <div className="text-xs text-zinc-600">
                Reviewer tier is required to post structured reviews (Plan §9.2). / 发布结构化评审需 Reviewer 权限（Plan §9.2）。
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-600">SIGNALS (12 months)</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="font-mono text-[10px]">
                  COMMENTS: {profile.counts.commentsPosted}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  REVIEWS: {profile.counts.reviewsPosted}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  WORK_ORDERS_PASSED: {profile.counts.workOrdersPassed}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  ER_CURATED: {profile.counts.externalReviewsCurated}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/20">
          <CardHeader className="space-y-2">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Contribution Graph
            </CardTitle>
            <div className="text-xs text-zinc-500">
              EN: activity over the last 12 months (demo aggregation from local stores). / 中文：近 12 个月贡献活动（从本地数据聚合）。
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-12 gap-2 items-end">
              {profile.timeline.map((b) => {
                const h = Math.max(6, Math.round((b.count / maxTimeline) * 72));
                return (
                  <div key={b.month} className="space-y-1">
                    <div
                      className="w-full bg-emerald-500/30 border border-emerald-500/20"
                      style={{ height: `${h}px` }}
                      title={`${b.month}: ${b.count}`}
                    />
                    <div className="text-[10px] font-mono text-zinc-600 text-center">{b.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            <Separator className="bg-zinc-800" />
            <div className="text-xs text-zinc-600">
              Signals count: comments/replies, reviews, external review curation, passed tickets/audits. Not votes or stance. / 统计：评论/回复、评审、外部审稿策展、通过工单/审计；不统计站队投票。
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20">
          <CardHeader className="space-y-2">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" /> Reputation Signals
            </CardTitle>
            <div className="text-xs text-zinc-500">Plan §10.1: what counts toward reputation.</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="emerald" className="font-mono text-[10px]">
                REVIEWS_ADDRESSED: {profile.signals.reviewsAddressed}
              </Badge>
              <Badge variant="amber" className="font-mono text-[10px]">
                COUNTEREXAMPLES_CONFIRMED: {profile.signals.keyCounterexamplesConfirmed}
              </Badge>
              <Badge variant="amber" className="font-mono text-[10px]">
                CITATIONS_CONFIRMED: {profile.signals.keyCitationsConfirmed}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                VERIFICATION_CONFIRMED: {profile.signals.verificationPassesConfirmed}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                REPLICATION_CONFIRMED: {profile.signals.replicationPassesConfirmed}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                LITERATURE_ADOPTED: {profile.signals.literatureMappingAdopted}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                EXTERNAL_CLAIM_MAPPING_RECOGNIZED: {profile.signals.externalClaimMappingRecognized}
              </Badge>
            </div>
            <div className="text-xs text-zinc-600">
              In this demo, “confirmed” is inferred from incorporated/resolved comment states, Addressed markers, and passed/audited tickets. / Demo 中，“确认”由评论状态（incorporated/resolved）、Addressed 标记、以及通过/审计工单推断。
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/20">
        <CardHeader className="space-y-2">
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-500" /> Badges
          </CardTitle>
          <div className="text-xs text-zinc-500">Examples from Plan §10.1 (demo heuristics).</div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profile.badges.map((b) => (
            <div key={b.id} className="border border-zinc-800 bg-black/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-200">{b.name}</div>
                <Badge variant={b.achieved ? "emerald" : "muted"} className="font-mono text-[10px]">
                  {b.achieved ? "UNLOCKED" : "LOCKED"}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500">{b.nameZh}</div>
              <div className="text-xs text-zinc-600">{b.criteriaEn}</div>
              <div className="text-xs text-zinc-600">{b.criteriaZh}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
