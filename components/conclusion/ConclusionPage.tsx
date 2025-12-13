"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Paper } from "@/lib/mockData";
import { papers as mockPapers } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { computeRiskReport, type IntegritySelfReport } from "@/lib/review/risk";
import type { EpistemicReview } from "@/lib/review/epistemic";
import type { DefenseEvaluation } from "@/lib/review/steelman";
import type { WorkOrdersStoreV1 } from "@/lib/review/verification";
import {
  computeActiveEpistemicReview,
  computeConclusionVersion,
  nextConclusionLabel,
  type ConclusionStoreV1,
  type ConclusionVersionV1,
} from "@/lib/review/conclusion";
import { IncentivesPanel } from "@/components/conclusion/IncentivesPanel";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, ScrollArea } from "@/components/ui/shadcn";
import { cn } from "@/lib/utils";

type EvidenceStoreV1 = {
  version: 1;
  updatedAt?: string;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
};

type SubmissionMetaV1 = {
  version: 1;
  paperId: string;
  updatedAt: string;
  selfReport?: IntegritySelfReport;
  userContext?: string;
  aiReviewAt?: string | null;
  defenseDeadlineAt?: string | null;
  paperSnapshot?: Paper;
};

type EpistemicStoreV2 = {
  version: 2;
  activeId: string | null;
  runs: EpistemicReview[];
};

type SteelmanStoreV1 = {
  version: 1;
  attackSet: unknown | null;
  responsesById: Record<string, string>;
  evaluation: DefenseEvaluation | null;
  userContext: string;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defaultSelfReport(): IntegritySelfReport {
  return {
    usesMl: false,
    trainTestSplit: "na",
    preregistered: "unknown",
    multipleHypotheses: "unknown",
    powerAnalysis: "na",
    sampleSize: "",
  };
}

function badgeVariantForVerdict(v: ConclusionVersionV1["summary"]["verdict"]) {
  if (v === "pass") return "emerald";
  if (v === "fail") return "destructive";
  if (v === "na") return "muted";
  return "amber";
}

function badgeVariantForWorkOrder(status: WorkOrdersStoreV1["orders"][number]["status"]) {
  if (status === "passed") return "emerald";
  if (status === "claimed" || status === "pass_pending_audit") return "amber";
  return "muted";
}

function conclusionKey(paperId: string) {
  return `omega_conclusion_v1:${paperId}`;
}

function evidenceKey(paperId: string) {
  return `omega_evidence_v1:${paperId}`;
}

function metaKey(paperId: string) {
  return `omega_submission_meta_v1:${paperId}`;
}

function paperSnapshotKey(paperId: string) {
  return `omega_paper_v1:${paperId}`;
}

function workOrdersKey(paperId: string) {
  return `omega_work_orders_v1:${paperId}`;
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

function formatReproStatus(s: ConclusionVersionV1["reproduction"]["status"]) {
  if (s === "verified") return "VERIFIED";
  if (s === "partial") return "PARTIAL";
  if (s === "in_progress") return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function ConclusionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paperParam = (searchParams.get("paper") || "").trim();
  const versionParam = (searchParams.get("v") || "").trim();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [paperId, setPaperId] = useState<string>(paperParam);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [evidencePointers, setEvidencePointers] = useState<EvidencePointer[]>([]);
  const [claimEvidence, setClaimEvidence] = useState<ClaimEvidence[]>([]);
  const [selfReport, setSelfReport] = useState<IntegritySelfReport>(() => defaultSelfReport());
  const [userContext, setUserContext] = useState("");

  const [workOrdersStore, setWorkOrdersStore] = useState<WorkOrdersStoreV1 | null>(null);
  const [epistemicStore, setEpistemicStore] = useState<EpistemicStoreV2 | null>(null);
  const [steelmanStore, setSteelmanStore] = useState<SteelmanStoreV1 | null>(null);

  const [conclusionStore, setConclusionStore] = useState<ConclusionStoreV1 | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!paperParam) return;
    setPaperId(paperParam);
  }, [paperParam]);

  useEffect(() => {
    const id = paperId.trim();
    if (!id) {
      setPaper(null);
      setLoadStatus("idle");
      setLoadError(null);
      return;
    }

    setLoadStatus("loading");
    setLoadError(null);

    const fromMock = mockPapers.find((p) => p.id === id) || null;
    if (fromMock) {
      setPaper(fromMock);
      setLoadStatus("idle");
      return;
    }

    const fromSnapshot = safeParseJson<Paper>(localStorage.getItem(paperSnapshotKey(id)));
    if (fromSnapshot?.id) {
      setPaper(fromSnapshot);
      setLoadStatus("idle");
      return;
    }

    const meta = safeParseJson<SubmissionMetaV1>(localStorage.getItem(metaKey(id)));
    if (meta?.version === 1 && meta.paperSnapshot?.id) {
      setPaper(meta.paperSnapshot);
      setLoadStatus("idle");
      return;
    }

    const match = id.match(/^zenodo-(\d+)$/);
    if (!match) {
      setPaper(null);
      setLoadError("Paper not found in mock data or local snapshot.");
      setLoadStatus("error");
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/zenodo/record/${encodeURIComponent(match[1])}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { paper?: Paper };
        if (!data.paper) throw new Error("Missing paper payload.");
        setPaper(data.paper);
        localStorage.setItem(paperSnapshotKey(id), JSON.stringify(data.paper));
        setLoadStatus("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load paper.";
        setPaper(null);
        setLoadError(message);
        setLoadStatus("error");
      }
    })();

    return () => controller.abort();
  }, [paperId]);

  useEffect(() => {
    const id = paperId.trim();
    if (!id) return;

    const storedEvidence = safeParseJson<Partial<EvidenceStoreV1>>(localStorage.getItem(evidenceKey(id)));
    if (storedEvidence?.version === 1) {
      setEvidencePointers(Array.isArray(storedEvidence.evidencePointers) ? (storedEvidence.evidencePointers as EvidencePointer[]) : []);
      setClaimEvidence(Array.isArray(storedEvidence.claimEvidence) ? (storedEvidence.claimEvidence as ClaimEvidence[]) : []);
    } else {
      setEvidencePointers([]);
      setClaimEvidence([]);
    }

    const meta = safeParseJson<SubmissionMetaV1>(localStorage.getItem(metaKey(id)));
    if (meta?.version === 1) {
      setSelfReport(meta.selfReport || defaultSelfReport());
      setUserContext(meta.userContext || "");
    } else {
      setSelfReport(defaultSelfReport());
      setUserContext("");
    }

    const wo = safeParseJson<WorkOrdersStoreV1>(localStorage.getItem(workOrdersKey(id)));
    if (wo?.version === 1 && wo.paperId === id) setWorkOrdersStore(wo);
    else setWorkOrdersStore(null);

    const epi = safeParseJson<EpistemicStoreV2>(localStorage.getItem(`omega_epistemic_review_v2:${id}`));
    if (epi?.version === 2 && Array.isArray(epi.runs)) setEpistemicStore(epi);
    else setEpistemicStore(null);

    const steel = safeParseJson<SteelmanStoreV1>(localStorage.getItem(`omega_steelman_v1:${id}`));
    if (steel?.version === 1) setSteelmanStore(steel);
    else setSteelmanStore(null);

    const store = safeParseJson<ConclusionStoreV1>(localStorage.getItem(conclusionKey(id)));
    if (store?.version === 1 && store.paperId === id) {
      setConclusionStore(store);
      setSelectedId(store.activeId || (store.versions[store.versions.length - 1]?.id ?? null));
    } else {
      setConclusionStore(null);
      setSelectedId(null);
    }
  }, [paperId]);

  useEffect(() => {
    if (!conclusionStore) return;
    localStorage.setItem(conclusionKey(conclusionStore.paperId), JSON.stringify(conclusionStore));
  }, [conclusionStore]);

  useEffect(() => {
    if (!versionParam.trim()) return;
    if (!conclusionStore?.versions?.length) return;
    const byId = conclusionStore.versions.find((v) => v.id === versionParam) || null;
    const byLabel = conclusionStore.versions.find((v) => v.versionLabel === versionParam) || null;
    setSelectedId(byId?.id || byLabel?.id || null);
  }, [conclusionStore, versionParam]);

  const activeEpistemicReview = useMemo(() => computeActiveEpistemicReview(epistemicStore), [epistemicStore]);
  const defenseEvaluation = steelmanStore?.evaluation || null;

  const risk = useMemo(() => {
    if (!paper) {
      return computeRiskReport({
        paper: {
          id: paperId,
          title: "Untitled",
          abstract: "",
          doi: "N/A",
          collectionVolume: "N/A",
          level: 0,
          articleType: "Preprint",
          discipline: "Digital Physics",
          keywords: [],
          authors: [{ name: "Unknown", isAI: false }],
          aiContributionPercent: 0,
          codeAvailable: false,
          dataAvailable: false,
          importedFrom: "Omega",
          versions: [],
          openReviewsCount: 0,
          reviews: [],
          falsifiabilityPath: "N/A",
        },
        evidencePointers,
        claimEvidence,
        selfReport,
      });
    }
    return computeRiskReport({ paper, evidencePointers, claimEvidence, selfReport });
  }, [claimEvidence, evidencePointers, paper, paperId, selfReport]);

  const draftConclusion = useMemo(() => {
    if (!paper) return null;
    return computeConclusionVersion({
      id: "draft",
      versionLabel: "DRAFT",
      createdAt: new Date().toISOString(),
      paper,
      evidencePointers,
      claimEvidence,
      risk,
      epistemicReview: activeEpistemicReview,
      defenseEvaluation,
      selfReport,
      workOrdersStore,
    });
  }, [activeEpistemicReview, claimEvidence, defenseEvaluation, evidencePointers, paper, risk, selfReport, workOrdersStore]);

  const selectedVersion = useMemo(() => {
    if (!conclusionStore?.versions?.length) return null;
    if (selectedId) return conclusionStore.versions.find((v) => v.id === selectedId) || null;
    return conclusionStore.versions[conclusionStore.versions.length - 1] || null;
  }, [conclusionStore, selectedId]);

  const displayed = selectedVersion || draftConclusion;

  const publishNewVersion = () => {
    if (!draftConclusion) return;
    const existing = conclusionStore?.versions || [];
    const label = nextConclusionLabel(existing);
    const id = makeId("conclusion");
    const createdAt = new Date().toISOString();

    const snapshot = computeConclusionVersion({
      id,
      versionLabel: label,
      createdAt,
      paper: draftConclusion.paperSnapshot,
      evidencePointers: draftConclusion.evidencePointers,
      claimEvidence: draftConclusion.claimEvidence,
      risk: draftConclusion.risk,
      epistemicReview: activeEpistemicReview,
      defenseEvaluation,
      selfReport,
      workOrdersStore,
    });

    const next: ConclusionStoreV1 = {
      version: 1,
      paperId: draftConclusion.paperId,
      activeId: snapshot.id,
      versions: [...existing, snapshot],
    };
    setConclusionStore(next);
    setSelectedId(snapshot.id);
    router.replace(`/conclusion?paper=${encodeURIComponent(draftConclusion.paperId)}&v=${encodeURIComponent(snapshot.versionLabel)}`);
  };

  const exportConclusion = () => {
    if (!displayed) return;
    downloadJson(`omega-conclusion-${paperId}-${displayed.versionLabel}.json`, displayed);
  };

  const exportEvidence = () => {
    if (!paperId.trim()) return;
    downloadJson(`omega-evidence-${paperId}.json`, {
      version: 1,
      paperId,
      exportedAt: new Date().toISOString(),
      evidencePointers,
      claimEvidence,
      selfReport,
      userContext,
    });
  };

  const exportWorkOrders = () => {
    if (!paperId.trim()) return;
    downloadJson(
      `omega-workorders-${paperId}.json`,
      workOrdersStore || { version: 1, paperId, updatedAt: new Date().toISOString(), orders: [], ledger: [] }
    );
  };

  const setActive = (id: string) => {
    if (!conclusionStore) return;
    setConclusionStore({ ...conclusionStore, activeId: id });
    setSelectedId(id);
  };

  const setPaperFromInput = (input: string) => {
    const id = input.trim();
    if (!id) return;
    router.push(`/conclusion?paper=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen pb-20">
      <section className="border-b border-zinc-800 bg-zinc-950/50 pt-14 pb-10">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl space-y-4">
            <div className="text-xs font-mono text-emerald-500">OMEGA_CONCLUSION_REPORT</div>
            <h1 className="text-3xl md:text-5xl font-serif font-medium text-white tracking-tight">Versioned Conclusion</h1>
            <p className="text-zinc-400">
              Structured conclusion with evidence alignment, risk labels, reproducibility status, and model/data cards.
            </p>

            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <Input
                value={paperId}
                onChange={(e) => setPaperId(e.target.value)}
                placeholder='Enter paper id (e.g. "zenodo-1234567" or "omega-001")'
                className="font-mono"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-700" onClick={() => setPaperFromInput(paperId)}>
                  LOAD
                </Button>
                <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => router.push("/")}>
                  BACK_TO_ARCHIVE
                </Button>
              </div>
            </div>

            {loadStatus === "loading" ? <div className="text-xs font-mono text-zinc-600">LOADING_PAPER...</div> : null}
            {loadError ? <div className="text-sm font-mono text-red-400">{loadError}</div> : null}
          </div>
        </div>
      </section>

      <div className="container px-4 md:px-6 py-8 space-y-6">
        {!paper ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">No Paper Loaded</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-400">
              Open from the archive drawer or `/submit`, or paste a paper id (e.g. `zenodo-1234567`).
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Paper</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="font-mono text-[10px]">
                  PAPER_ID: {paper.id}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  SOURCE: {paper.importedFrom}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  DOI: {paper.doi}
                </Badge>
                {displayed ? (
                  <Badge variant={badgeVariantForVerdict(displayed.summary.verdict)} className="font-mono text-[10px]">
                    VERDICT: {displayed.summary.verdict.toUpperCase()}
                  </Badge>
                ) : null}
              </div>

              <div className="text-xl font-semibold text-white">{paper.title}</div>
              <div className="text-sm text-zinc-400">{paper.authors.map((a) => a.name).join(", ")}</div>
              <div className="text-sm text-zinc-400 whitespace-pre-line">{paper.abstract}</div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button variant="emerald" onClick={publishNewVersion} disabled={!draftConclusion}>
                  PUBLISH_NEW_VERSION
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={exportConclusion} disabled={!displayed}>
                  EXPORT_CONCLUSION_JSON
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={exportEvidence} disabled={!paperId.trim()}>
                  EXPORT_EVIDENCE_JSON
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={exportWorkOrders} disabled={!paperId.trim()}>
                  EXPORT_WORKORDERS_JSON
                </Button>
                <div className="text-xs font-mono text-zinc-600">
                  {conclusionStore?.versions?.length
                    ? `PUBLISHED: ${conclusionStore.versions.length} versions`
                    : "No published versions yet (showing DRAFT)."}{" "}
                  {userContext ? "| CONTEXT: yes" : "| CONTEXT: no"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {conclusionStore?.versions?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Version History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {conclusionStore.versions
                  .slice()
                  .reverse()
                  .map((v) => {
                    const isActive = v.id === conclusionStore.activeId;
                    const isSelected = v.id === selectedId;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedId(v.id)}
                        className={cn(
                          "text-left border border-zinc-800 bg-zinc-950 p-3 hover:border-emerald-500 transition-colors",
                          isSelected ? "border-emerald-500" : ""
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-zinc-400">
                              {v.versionLabel}
                            </Badge>
                            <Badge variant={badgeVariantForVerdict(v.summary.verdict)} className="font-mono text-[10px]">
                              {v.summary.verdict.toUpperCase()}
                            </Badge>
                            <Badge variant="muted" className="font-mono text-[10px]">
                              SCORE: {v.summary.overallScore}/5
                            </Badge>
                          </div>
                          {isActive ? (
                            <Badge variant="emerald" className="font-mono text-[10px]">
                              ACTIVE
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs font-mono text-zinc-600">{new Date(v.createdAt).toLocaleString()}</div>
                        <div className="mt-2 text-xs text-zinc-500">REPRO: {formatReproStatus(v.reproduction.status)}</div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "outline" : "emerald"}
                            className={cn("h-7 text-xs", isActive ? "border-zinc-700 text-zinc-400" : "")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActive(v.id);
                            }}
                          >
                            {isActive ? "ACTIVE" : "SET_ACTIVE"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-zinc-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.replace(`/conclusion?paper=${encodeURIComponent(paperId)}&v=${encodeURIComponent(v.versionLabel)}`);
                            }}
                          >
                            LINK
                          </Button>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {paper && displayed ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Final Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant={badgeVariantForVerdict(displayed.summary.verdict)} className="font-mono text-[10px]">
                  {displayed.summary.verdict.toUpperCase()}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  OVERALL_SCORE: {displayed.summary.overallScore}/5
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  REPRO_STATUS: {formatReproStatus(displayed.reproduction.status)}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  EVIDENCE_COVERAGE: {Math.round(displayed.risk.summary.evidenceCoverage * 100)}%
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  TRACEABILITY: {Math.round(displayed.risk.summary.traceability * 100)}%
                </Badge>
              </div>
              <div className="text-sm text-zinc-300">{displayed.summary.oneLine}</div>
              <div className="text-xs font-mono text-zinc-600">
                VERSION: {displayed.versionLabel} | GENERATED_AT: {new Date(displayed.createdAt).toLocaleString()}
              </div>
              {activeEpistemicReview ? (
                <div className="text-xs font-mono text-zinc-700">EPISTEMIC_RUN: {activeEpistemicReview.id}</div>
              ) : (
                <div className="text-xs font-mono text-zinc-700">EPISTEMIC_RUN: none</div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {paper && displayed ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Rubric (0–5) + Auto-tests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayed.rubric.map((d) => (
                  <div key={d.id} className="border border-zinc-800 bg-black/30 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-100">{d.label}</div>
                      <Badge variant="muted" className="font-mono text-[10px]">
                        SCORE: {d.score}/5
                      </Badge>
                    </div>
                    <div className="text-sm text-zinc-400">{d.rationale}</div>
                    <details className="border border-zinc-800 bg-zinc-950 p-3">
                      <summary className="cursor-pointer text-xs font-mono text-zinc-500">AUTO_TESTS ({d.tests.length})</summary>
                      <div className="mt-3 space-y-2">
                        {d.tests.map((t) => (
                          <div key={t.id} className="border border-zinc-800 bg-black/30 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={badgeVariantForVerdict(t.status)} className="font-mono text-[10px] px-2 py-0.5">
                                {t.status.toUpperCase()}
                              </Badge>
                              <div className="text-sm text-zinc-200">{t.label}</div>
                            </div>
                            <div className="mt-2 text-xs text-zinc-500">{t.detail}</div>
                            {t.fix ? (
                              <div className="mt-2 text-xs font-mono text-emerald-500 break-words">FIX: {t.fix}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Risk Labels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayed.risk.flags.length ? (
                  displayed.risk.flags.map((f) => (
                    <div key={f.id} className="border border-zinc-800 bg-black/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={f.severity === "high" ? "destructive" : f.severity === "medium" ? "amber" : "muted"}
                          className="font-mono text-[10px] px-2 py-0.5"
                        >
                          {f.severity.toUpperCase()}
                        </Badge>
                        <div className="text-sm font-semibold text-zinc-100">{f.title}</div>
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">{f.detail}</div>
                      <div className="mt-2 text-xs font-mono text-emerald-500 break-words">FIX: {f.fix}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600 italic">No risk flags detected from current metadata.</div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {paper && displayed ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Reproducibility Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="font-mono text-[10px]">
                  TOTAL: {displayed.reproduction.total}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  OPEN: {displayed.reproduction.open}
                </Badge>
                <Badge variant="amber" className="font-mono text-[10px]">
                  CLAIMED: {displayed.reproduction.claimed}
                </Badge>
                <Badge variant="emerald" className="font-mono text-[10px]">
                  PASSED: {displayed.reproduction.passed}
                </Badge>
                <Badge variant="muted" className="font-mono text-[10px]">
                  STATUS: {formatReproStatus(displayed.reproduction.status)}
                </Badge>
              </div>

              {workOrdersStore?.orders?.length ? (
                <div className="space-y-2">
                  {workOrdersStore.orders.map((o) => (
                    <div key={o.id} className="border border-zinc-800 bg-black/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={badgeVariantForWorkOrder(o.status)} className="font-mono text-[10px] px-2 py-0.5">
                            {o.status.toUpperCase()}
                          </Badge>
                          <div className="text-sm text-zinc-200 font-semibold">{o.title}</div>
                        </div>
                        <div className="text-xs font-mono text-zinc-600 break-all">{o.id}</div>
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">{o.claim}</div>
                      {o.lastAttempt ? (
                        <div className="mt-2 text-xs font-mono text-zinc-600">
                          LAST: {o.lastAttempt.result.toUpperCase()} by {o.lastAttempt.by} @{" "}
                          {new Date(o.lastAttempt.at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-600 italic">
                  No work orders yet. Open the `Verify` tab for this paper to generate and claim tickets.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {paper ? (
          <IncentivesPanel
            paper={paper}
            paperId={paper.id}
            claimEvidence={claimEvidence}
            alignment={activeEpistemicReview?.alignment || []}
            defenseEvaluation={defenseEvaluation}
            workOrdersStore={workOrdersStore}
          />
        ) : null}

        {paper && displayed ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Conclusion Evidence Alignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayed.alignment.length ? (
                <ScrollArea className="max-h-[560px]">
                  <div className="space-y-3 pr-3">
                    {displayed.alignment.map((row, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-black/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="text-sm text-zinc-200 font-semibold">{row.claim}</div>
                          <Badge variant={badgeVariantForVerdict(row.status)} className="font-mono text-[10px] px-2 py-0.5">
                            {row.status.toUpperCase()}
                          </Badge>
                        </div>

                        {row.evidence.length ? (
                          <div className="mt-3">
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">EVIDENCE</div>
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {row.evidence.map((e, j) => (
                                <li key={j} className="break-words">
                                  {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {row.gaps.length ? (
                          <div className="mt-3">
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">GAPS</div>
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {row.gaps.map((g, j) => (
                                <li key={j} className="break-words">
                                  {g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {row.counterTests.length ? (
                          <div className="mt-3">
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">AUTO_COUNTER_TESTS</div>
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {row.counterTests.map((t, j) => (
                                <li key={j} className="break-words">
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-zinc-600 italic">
                  No alignment matrix yet. Run `AI Initial Review` from `/submit` or the paper drawer `Epistemic` tab.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {paper && displayed ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[displayed.modelCard, displayed.dataCard].map((card) => (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle className="text-zinc-100">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {card.fields.map((f) => (
                    <div key={f.label} className="border border-zinc-800 bg-black/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-mono text-zinc-500">{f.label.toUpperCase()}</div>
                        {f.status ? (
                          <Badge variant={badgeVariantForVerdict(f.status)} className="font-mono text-[10px] px-2 py-0.5">
                            {f.status.toUpperCase()}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm text-zinc-200 whitespace-pre-line break-words">{f.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
