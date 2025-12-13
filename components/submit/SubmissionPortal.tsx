"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer, EvidencePointerType } from "@/lib/review/evidence";
import { formatEvidencePointer } from "@/lib/review/evidence";
import { generateMockEpistemicReview, type EpistemicReview } from "@/lib/review/epistemic";
import { generateMockSteelmanAttackSet, type SteelmanAttackSet } from "@/lib/review/steelman";
import { computeRiskReport, type IntegritySelfReport } from "@/lib/review/risk";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn";
import { EpistemicReviewPanel } from "@/components/review/EpistemicReviewPanel";
import { RadarChart } from "@/components/review/RadarChart";
import { SteelmanDefensePanel } from "@/components/review/SteelmanDefensePanel";
import { VerificationWorkOrdersPanel } from "@/components/review/VerificationWorkOrdersPanel";

type EnginePref = "auto" | "simulated";

type SelfReport = IntegritySelfReport;

type Draft = {
  paperId: string;
  importedFrom: Paper["importedFrom"];
  title: string;
  doi: string;
  authorsText: string;
  abstract: string;
  discipline: Paper["discipline"];
  articleType: Paper["articleType"];
  keywordsText: string;
  falsifiabilityPath: string;
  collectionVolume: string;
  aiContributionPercent: string;
  codeUrl: string;
  codeCommit: string;
  codeHash: string;
  dataUrl: string;
  dataHash: string;
};

type SubmissionStoreV1 = {
  version: 1;
  draft: Draft;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  engine: EnginePref;
  userContext: string;
  selfReport: SelfReport;
  aiReviewAt: string | null;
  defenseDeadlineAt: string | null;
};

type ReviewStoreV2 = {
  version: 2;
  activeId: string | null;
  runs: EpistemicReview[];
};

type SteelmanStoreV1 = {
  version: 1;
  attackSet: SteelmanAttackSet | null;
  responsesById: Record<string, string>;
  evaluation: unknown | null;
  userContext: string;
};

const SUBMISSION_STORE_KEY = "omega_submission_portal_v1";

const DISCIPLINES: Paper["discipline"][] = [
  "Digital Physics",
  "Cellular Automata",
  "Thermodynamics",
  "AI Foundations",
  "Cosmology",
];

const ARTICLE_TYPES: Paper["articleType"][] = [
  "Preprint",
  "Methods Note",
  "Replication Report",
  "Survey",
  "Negative Result",
];

const EVIDENCE_TYPES: EvidencePointerType[] = ["figure", "table", "data", "code", "stat_test", "appendix", "doi", "url"];

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

function isAiName(name: string) {
  return /(^|\b)(gpt|chatgpt|llm|ai|claude|gemini|openai|anthropic)\b/i.test(name);
}

function parseCsv(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

function defaultDraft(): Draft {
  return {
    paperId: makeId("omega"),
    importedFrom: "Omega",
    title: "",
    doi: "",
    authorsText: "",
    abstract: "",
    discipline: "Digital Physics",
    articleType: "Preprint",
    keywordsText: "",
    falsifiabilityPath: "",
    collectionVolume: "Omega Submissions",
    aiContributionPercent: "0",
    codeUrl: "",
    codeCommit: "",
    codeHash: "",
    dataUrl: "",
    dataHash: "",
  };
}

function defaultSelfReport(): SelfReport {
  return {
    usesMl: false,
    trainTestSplit: "na",
    preregistered: "unknown",
    multipleHypotheses: "unknown",
    powerAnalysis: "na",
    sampleSize: "",
  };
}

function draftToPaper(draft: Draft): Paper {
  const authors = parseCsv(draft.authorsText).map((name) => ({ name, isAI: isAiName(name) }));
  const aiContributionPercent = Number.isFinite(Number(draft.aiContributionPercent))
    ? Math.max(0, Math.min(100, Number(draft.aiContributionPercent)))
    : 0;
  const keywords = parseCsv(draft.keywordsText);

  return {
    id: draft.paperId,
    title: draft.title || "Untitled Submission",
    abstract: draft.abstract || "No abstract provided.",
    doi: draft.doi || "N/A",
    collectionVolume: draft.collectionVolume || "Omega Submissions",
    level: 0,
    articleType: draft.articleType,
    discipline: draft.discipline,
    keywords,
    authors: authors.length ? authors : [{ name: "Unknown", isAI: false }],
    aiContributionPercent,
    codeAvailable: Boolean(draft.codeUrl.trim()),
    codeUrl: draft.codeUrl.trim() || undefined,
    codeHash: draft.codeHash.trim() || undefined,
    dataAvailable: Boolean(draft.dataUrl.trim()),
    dataUrl: draft.dataUrl.trim() || undefined,
    importedFrom: draft.importedFrom,
    versions: [{ version: "v1.0", date: new Date().toISOString().slice(0, 10), note: "Submission draft" }],
    openReviewsCount: 0,
    reviews: [],
    replicationBounty: undefined,
    falsifiabilityPath: draft.falsifiabilityPath.trim() || "N/A",
  };
}

function safeParseSubmissionStore(raw: string | null): SubmissionStoreV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<SubmissionStoreV1>;
    if (obj.version !== 1) return null;
    if (!obj.draft) return null;
    return {
      version: 1,
      draft: obj.draft as Draft,
      evidencePointers: Array.isArray(obj.evidencePointers) ? (obj.evidencePointers as EvidencePointer[]) : [],
      claimEvidence: Array.isArray(obj.claimEvidence) ? (obj.claimEvidence as ClaimEvidence[]) : [],
      engine: obj.engine === "simulated" ? "simulated" : "auto",
      userContext: typeof obj.userContext === "string" ? obj.userContext : "",
      selfReport: (obj.selfReport as SelfReport) || defaultSelfReport(),
      aiReviewAt: typeof obj.aiReviewAt === "string" ? obj.aiReviewAt : null,
      defenseDeadlineAt: typeof obj.defenseDeadlineAt === "string" ? obj.defenseDeadlineAt : null,
    };
  } catch {
    return null;
  }
}

function evidenceStorageKey(paperId: string) {
  return `omega_evidence_v1:${paperId}`;
}

function submissionMetaKey(paperId: string) {
  return `omega_submission_meta_v1:${paperId}`;
}

function paperSnapshotKey(paperId: string) {
  return `omega_paper_v1:${paperId}`;
}

function safeParseEvidenceStore(raw: string | null): { evidencePointers: EvidencePointer[]; claimEvidence: ClaimEvidence[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<{ version: number; evidencePointers: unknown; claimEvidence: unknown }>;
    if (obj.version !== 1) return null;
    return {
      evidencePointers: Array.isArray(obj.evidencePointers) ? (obj.evidencePointers as EvidencePointer[]) : [],
      claimEvidence: Array.isArray(obj.claimEvidence) ? (obj.claimEvidence as ClaimEvidence[]) : [],
    };
  } catch {
    return null;
  }
}

function buildUserContext(userContext: string, selfReport: SelfReport, evidencePointers: EvidencePointer[], claimEvidence: ClaimEvidence[]) {
  const lines: string[] = [];
  if (selfReport.usesMl) lines.push("SELF_REPORT: uses_ml=yes");
  lines.push(`SELF_REPORT: train_test_split=${selfReport.trainTestSplit}`);
  lines.push(`SELF_REPORT: preregistered=${selfReport.preregistered}`);
  lines.push(`SELF_REPORT: multiple_hypotheses=${selfReport.multipleHypotheses}`);
  lines.push(`SELF_REPORT: power_analysis=${selfReport.powerAnalysis}`);
  if (selfReport.sampleSize.trim()) lines.push(`SELF_REPORT: sample_size=${selfReport.sampleSize.trim()}`);
  if (evidencePointers.length) lines.push(`EVIDENCE_POINTERS: ${evidencePointers.length}`);
  if (claimEvidence.length) lines.push(`CLAIMS: ${claimEvidence.length}`);
  const header = lines.join("\n");
  const extra = userContext.trim();
  return extra ? `${header}\n\nAUTHOR_CONTEXT:\n${extra}` : header;
}

export function SubmissionPortal() {
  const [tab, setTab] = useState<"submit" | "triage" | "defense" | "community">("submit");
  const [draft, setDraft] = useState<Draft>(() => defaultDraft());
  const [zenodoImport, setZenodoImport] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [engine, setEngine] = useState<EnginePref>("auto");
  const [userContext, setUserContext] = useState("");
  const [selfReport, setSelfReport] = useState<SelfReport>(() => defaultSelfReport());
  const [evidencePointers, setEvidencePointers] = useState<EvidencePointer[]>([]);
  const [claimEvidence, setClaimEvidence] = useState<ClaimEvidence[]>([]);
  const [aiReviewAt, setAiReviewAt] = useState<string | null>(null);
  const [defenseDeadlineAt, setDefenseDeadlineAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const paper = useMemo(() => draftToPaper(draft), [draft]);
  const reviewContext = useMemo(
    () => buildUserContext(userContext, selfReport, evidencePointers, claimEvidence),
    [claimEvidence, evidencePointers, selfReport, userContext]
  );
  const riskReport = useMemo(
    () => computeRiskReport({ paper, evidencePointers, claimEvidence, selfReport }),
    [claimEvidence, evidencePointers, paper, selfReport]
  );

  useEffect(() => {
    const stored = safeParseSubmissionStore(localStorage.getItem(SUBMISSION_STORE_KEY));
    if (!stored) return;
    setDraft(stored.draft);
    setEvidencePointers(stored.evidencePointers);
    setClaimEvidence(stored.claimEvidence);
    setEngine(stored.engine);
    setUserContext(stored.userContext);
    setSelfReport(stored.selfReport);
    setAiReviewAt(stored.aiReviewAt);
    setDefenseDeadlineAt(stored.defenseDeadlineAt);
  }, []);

  useEffect(() => {
    const payload: SubmissionStoreV1 = {
      version: 1,
      draft,
      evidencePointers,
      claimEvidence,
      engine,
      userContext,
      selfReport,
      aiReviewAt,
      defenseDeadlineAt,
    };
    localStorage.setItem(SUBMISSION_STORE_KEY, JSON.stringify(payload));
  }, [aiReviewAt, claimEvidence, defenseDeadlineAt, draft, engine, evidencePointers, selfReport, userContext]);

  useEffect(() => {
    const key = evidenceStorageKey(paper.id);
    const stored = safeParseEvidenceStore(localStorage.getItem(key));
    if (stored) {
      setEvidencePointers(stored.evidencePointers);
      setClaimEvidence(stored.claimEvidence);
    } else {
      setEvidencePointers([]);
      setClaimEvidence([]);
    }
    // only on paper id change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id]);

  useEffect(() => {
    const key = evidenceStorageKey(paper.id);
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        evidencePointers,
        claimEvidence,
      })
    );
  }, [claimEvidence, evidencePointers, paper.id]);

  useEffect(() => {
    const nowIso = new Date().toISOString();
    localStorage.setItem(paperSnapshotKey(paper.id), JSON.stringify(paper));
    localStorage.setItem(
      submissionMetaKey(paper.id),
      JSON.stringify({
        version: 1,
        paperId: paper.id,
        updatedAt: nowIso,
        paperSnapshot: paper,
        selfReport,
        userContext,
        aiReviewAt,
        defenseDeadlineAt,
      })
    );
  }, [aiReviewAt, defenseDeadlineAt, paper, selfReport, userContext]);

  useEffect(() => {
    const pointerIds = new Set(evidencePointers.map((p) => p.id));
    setClaimEvidence((prev) =>
      prev.map((c) => ({
        ...c,
        evidenceIds: (c.evidenceIds || []).filter((id) => pointerIds.has(id)),
      }))
    );
  }, [evidencePointers]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLeft = useMemo(() => {
    if (!defenseDeadlineAt) return null;
    const ms = new Date(defenseDeadlineAt).getTime() - now;
    return ms;
  }, [defenseDeadlineAt, now]);

  const [runStatus, setRunStatus] = useState<"idle" | "running" | "error">("idle");
  const [runError, setRunError] = useState<string | null>(null);

  const resetDraft = () => {
    setDraft(defaultDraft());
    setEvidencePointers([]);
    setClaimEvidence([]);
    setSelfReport(defaultSelfReport());
    setAiReviewAt(null);
    setDefenseDeadlineAt(null);
    setRunStatus("idle");
    setRunError(null);
    setTab("submit");
  };

  const extractZenodoId = (input: string) => {
    const text = input.trim();
    const m1 = text.match(/zenodo\.(\d+)/i);
    if (m1?.[1]) return m1[1];
    const m2 = text.match(/records\/(\d+)/i);
    if (m2?.[1]) return m2[1];
    const m3 = text.match(/\b(\d{6,})\b/);
    if (m3?.[1]) return m3[1];
    return null;
  };

  const importFromZenodo = async () => {
    setImportStatus("importing");
    setImportError(null);

    try {
      const id = extractZenodoId(zenodoImport);
      if (!id) throw new Error("Enter a Zenodo record id, DOI (10.5281/zenodo.x), or a Zenodo URL.");

      const res = await fetch(`/api/zenodo/record/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`Zenodo import failed (${res.status})`);

      const data = (await res.json()) as { paper?: Paper };
      if (!data.paper) throw new Error("Missing paper payload.");

      const p = data.paper;
      setDraft({
        paperId: p.id,
        importedFrom: p.importedFrom,
        title: p.title,
        doi: p.doi,
        authorsText: p.authors.map((a) => a.name).join(", "),
        abstract: p.abstract,
        discipline: p.discipline,
        articleType: p.articleType,
        keywordsText: (p.keywords || []).join(", "),
        falsifiabilityPath: p.falsifiabilityPath || "",
        collectionVolume: p.collectionVolume || "Zenodo Import",
        aiContributionPercent: String(p.aiContributionPercent ?? 0),
        codeUrl: p.codeUrl || "",
        codeCommit: "",
        codeHash: p.codeHash || "",
        dataUrl: p.dataUrl || "",
        dataHash: "",
      });

      setAiReviewAt(null);
      setDefenseDeadlineAt(null);
      setTab("submit");
      setImportStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed.";
      setImportError(message);
      setImportStatus("error");
    }
  };

  const runInitialReview = async () => {
    setRunStatus("running");
    setRunError(null);

    try {
      const context = reviewContext;

      const epistemicRes = await fetch("/api/review/epistemic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper, engine, userContext: context, evidencePointers, claimEvidence }),
      }).catch(() => null);

      let review: EpistemicReview | null = null;
      if (epistemicRes && epistemicRes.ok) {
        const data = (await epistemicRes.json()) as { review?: EpistemicReview };
        review = data.review || null;
      } else {
        review = generateMockEpistemicReview(paper, { userContext: context, evidencePointers, claimEvidence });
      }

      const steelmanRes = await fetch("/api/review/steelman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper, engine, userContext: context, evidencePointers }),
      }).catch(() => null);

      let attackSet: SteelmanAttackSet | null = null;
      if (steelmanRes && steelmanRes.ok) {
        const data = (await steelmanRes.json()) as { attackSet?: SteelmanAttackSet };
        attackSet = data.attackSet || null;
      } else {
        attackSet = generateMockSteelmanAttackSet(paper, { userContext: context, evidencePointers });
      }

      if (!review || !attackSet) throw new Error("Missing review payload.");

      const reviewKey = `omega_epistemic_review_v2:${paper.id}`;
      const existing = (() => {
        const raw = localStorage.getItem(reviewKey);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as Partial<ReviewStoreV2>;
          if (parsed.version !== 2) return null;
          if (!Array.isArray(parsed.runs)) return null;
          return parsed as ReviewStoreV2;
        } catch {
          return null;
        }
      })();
      const nextRuns = [...(existing?.runs || []), review];
      const nextStore: ReviewStoreV2 = { version: 2, activeId: review.id, runs: nextRuns };
      localStorage.setItem(reviewKey, JSON.stringify(nextStore));

      const steelmanKey = `omega_steelman_v1:${paper.id}`;
      const steelmanStore: SteelmanStoreV1 = {
        version: 1,
        attackSet,
        responsesById: {},
        evaluation: null,
        userContext: context,
      };
      localStorage.setItem(steelmanKey, JSON.stringify(steelmanStore));

      const startedAt = new Date().toISOString();
      const deadlineAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      setAiReviewAt(startedAt);
      setDefenseDeadlineAt(deadlineAt);
      setTab("triage");
      setRunStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run review.";
      setRunError(message);
      setRunStatus("error");
    }
  };

  const addEvidencePointer = () => {
    setEvidencePointers((prev) => [
      ...prev,
      {
        id: makeId("ev"),
        type: "figure",
        label: "",
        ref: "",
        url: "",
        doi: "",
        commit: "",
        hash: "",
        note: "",
      },
    ]);
  };

  const updateEvidencePointer = (id: string, patch: Partial<EvidencePointer>) => {
    setEvidencePointers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeEvidencePointer = (id: string) => {
    setEvidencePointers((prev) => prev.filter((p) => p.id !== id));
  };

  const addClaim = () => {
    setClaimEvidence((prev) => [...prev, { claim: "", evidenceIds: [] }]);
  };

  const updateClaimText = (idx: number, claim: string) => {
    setClaimEvidence((prev) => prev.map((c, i) => (i === idx ? { ...c, claim } : c)));
  };

  const removeClaim = (idx: number) => {
    setClaimEvidence((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleClaimEvidence = (idx: number, evidenceId: string) => {
    setClaimEvidence((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const has = (c.evidenceIds || []).includes(evidenceId);
        const evidenceIds = has ? (c.evidenceIds || []).filter((id) => id !== evidenceId) : [...(c.evidenceIds || []), evidenceId];
        return { ...c, evidenceIds };
      })
    );
  };

  const claimsWithEvidence = useMemo(
    () => claimEvidence.filter((c) => c.claim.trim() && (c.evidenceIds || []).length > 0).length,
    [claimEvidence]
  );

  return (
    <div className="min-h-screen pb-20">
      <section className="border-b border-zinc-800 bg-zinc-950/50 pt-14 pb-10">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl space-y-4">
            <div className="text-xs font-mono text-emerald-500">OMEGA_SUBMISSION_PORTAL</div>
            <h1 className="text-3xl md:text-5xl font-serif font-medium text-white tracking-tight">
              Structured submission → AI triage → adversarial defense.
            </h1>
            <p className="text-zinc-400">
              Submit claims with traceable evidence pointers. Omega runs an epistemic rubric and generates the strongest rebuttals.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="muted" className="font-mono text-[10px]">
                NO_BACKEND
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                MOCK_DATA_OK
              </Badge>
              <Badge variant="emerald" className="font-mono text-[10px]">
                EVIDENCE_POINTERS
              </Badge>
            </div>
          </div>
        </div>
      </section>

          <div className="container px-4 md:px-6 py-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="submit">Submission</TabsTrigger>
            <TabsTrigger value="triage">AI Triage</TabsTrigger>
            <TabsTrigger value="defense">Defense</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Import from Zenodo (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-zinc-400">
                  If your work already lives on Zenodo, import by record id or DOI and add Omega-specific claims + evidence pointers.
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input
                    value={zenodoImport}
                    onChange={(e) => setZenodoImport(e.target.value)}
                    placeholder="e.g. 1234567 or 10.5281/zenodo.1234567"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-zinc-700"
                      onClick={() => void importFromZenodo()}
                      disabled={importStatus === "importing"}
                    >
                      {importStatus === "importing" ? "IMPORTING..." : "IMPORT"}
                    </Button>
                    <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={resetDraft}>
                      NEW_DRAFT
                    </Button>
                  </div>
                </div>
                {importError ? <div className="text-sm text-red-400 font-mono">{importError}</div> : null}
                <div className="text-xs font-mono text-zinc-600">
                  ACTIVE_PAPER_ID: {paper.id} | SOURCE: {paper.importedFrom}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Manuscript Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">TITLE</label>
                    <Input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">DOI (OR N/A)</label>
                    <Input value={draft.doi} onChange={(e) => setDraft((p) => ({ ...p, doi: e.target.value }))} placeholder="10.5281/zenodo.xxxxxxx" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">AUTHORS (comma-separated)</label>
                  <Input value={draft.authorsText} onChange={(e) => setDraft((p) => ({ ...p, authorsText: e.target.value }))} placeholder="Alice, Bob, Omega AI" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">ABSTRACT</label>
                  <textarea
                    value={draft.abstract}
                    onChange={(e) => setDraft((p) => ({ ...p, abstract: e.target.value }))}
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[120px] focus:outline-none focus:border-emerald-500"
                    placeholder="Paste the abstract/description here."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">ARTICLE_TYPE</label>
                    <select
                      value={draft.articleType}
                      onChange={(e) => setDraft((p) => ({ ...p, articleType: e.target.value as Paper["articleType"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {ARTICLE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">DISCIPLINE</label>
                    <select
                      value={draft.discipline}
                      onChange={(e) => setDraft((p) => ({ ...p, discipline: e.target.value as Paper["discipline"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">KEYWORDS (comma-separated)</label>
                    <Input value={draft.keywordsText} onChange={(e) => setDraft((p) => ({ ...p, keywordsText: e.target.value }))} placeholder="e.g. cellular automata, entropy" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">FALSIFIABILITY_PATH</label>
                  <textarea
                    value={draft.falsifiabilityPath}
                    onChange={(e) => setDraft((p) => ({ ...p, falsifiabilityPath: e.target.value }))}
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                    placeholder="Define a concrete falsification test with threshold + negative control."
                  />
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-4">
                  <div className="text-xs font-mono text-emerald-500">ARTIFACTS_TRACEABILITY</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">CODE_URL</label>
                      <Input
                        value={draft.codeUrl}
                        onChange={(e) => setDraft((p) => ({ ...p, codeUrl: e.target.value }))}
                        placeholder="https://github.com/org/repo"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">CODE_COMMIT (optional)</label>
                      <Input
                        value={draft.codeCommit}
                        onChange={(e) => setDraft((p) => ({ ...p, codeCommit: e.target.value }))}
                        placeholder="e.g. 1a2b3c4d"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">CODE_HASH (optional)</label>
                      <Input
                        value={draft.codeHash}
                        onChange={(e) => setDraft((p) => ({ ...p, codeHash: e.target.value }))}
                        placeholder="sha256 / swhid / tag"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">DATA_URL (optional)</label>
                      <Input
                        value={draft.dataUrl}
                        onChange={(e) => setDraft((p) => ({ ...p, dataUrl: e.target.value }))}
                        placeholder="Zenodo / OSF / IPFS / S3"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-mono text-zinc-500">DATA_HASH (optional)</label>
                      <Input
                        value={draft.dataHash}
                        onChange={(e) => setDraft((p) => ({ ...p, dataHash: e.target.value }))}
                        placeholder="sha256 / content hash"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Evidence Pointer Index</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-400">
                    Add traceable pointers (figure/table/data/code/stat tests) so every claim can be audited.
                  </div>
                  <Button size="sm" variant="outline" className="border-zinc-700" onClick={addEvidencePointer}>
                    + Add Evidence Pointer
                  </Button>
                </div>

                {evidencePointers.length ? (
                  <div className="space-y-3">
                    {evidencePointers.map((p) => (
                      <div key={p.id} className="border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-mono text-zinc-600">ID: {p.id}</div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white" onClick={() => removeEvidencePointer(p.id)}>
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">TYPE</label>
                            <select
                              value={p.type}
                              onChange={(e) => updateEvidencePointer(p.id, { type: e.target.value as EvidencePointerType })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                            >
                              {EVIDENCE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-mono text-zinc-500">LABEL</label>
                            <Input value={p.label} onChange={(e) => updateEvidencePointer(p.id, { label: e.target.value })} placeholder="e.g. Figure 2: ablation curve" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">REF (optional)</label>
                            <Input value={p.ref || ""} onChange={(e) => updateEvidencePointer(p.id, { ref: e.target.value })} placeholder="Fig.2 / Tab.1 / Appendix A" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">URL (optional)</label>
                            <Input value={p.url || ""} onChange={(e) => updateEvidencePointer(p.id, { url: e.target.value })} placeholder="https://..." />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">DOI (optional)</label>
                            <Input value={p.doi || ""} onChange={(e) => updateEvidencePointer(p.id, { doi: e.target.value })} placeholder="10.xxxx/..." />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">COMMIT / HASH (optional)</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={p.commit || ""} onChange={(e) => updateEvidencePointer(p.id, { commit: e.target.value })} placeholder="commit" />
                              <Input value={p.hash || ""} onChange={(e) => updateEvidencePointer(p.id, { hash: e.target.value })} placeholder="hash" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-mono text-zinc-500">NOTE (optional)</label>
                          <Input value={p.note || ""} onChange={(e) => updateEvidencePointer(p.id, { note: e.target.value })} placeholder="Why this pointer matters / how to reproduce." />
                        </div>

                        <div className="text-xs font-mono text-zinc-600 break-words">FORMATTED: {formatEvidencePointer(p)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 italic">No evidence pointers yet. Add at least 3–5 (core figures + code + data).</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Claims → Evidence Mapping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-400">
                    Claims with evidence:{" "}
                    <span className="font-mono text-emerald-500">
                      {claimsWithEvidence}/{claimEvidence.length}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="border-zinc-700" onClick={addClaim}>
                    + Add Claim
                  </Button>
                </div>

                {claimEvidence.length ? (
                  <div className="space-y-3">
                    {claimEvidence.map((c, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-mono text-zinc-600">CLAIM #{idx + 1}</div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white" onClick={() => removeClaim(idx)}>
                            Remove
                          </Button>
                        </div>
                        <textarea
                          value={c.claim}
                          onChange={(e) => updateClaimText(idx, e.target.value)}
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[72px] focus:outline-none focus:border-emerald-500"
                          placeholder="State a single falsifiable claim with scope boundaries."
                        />
                        {evidencePointers.length ? (
                          <div className="border border-zinc-800 bg-black/30 p-3">
                            <div className="text-[10px] font-mono text-zinc-600 mb-2">EVIDENCE_LINKS</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {evidencePointers.map((p) => {
                                const checked = (c.evidenceIds || []).includes(p.id);
                                return (
                                  <label key={p.id} className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 accent-emerald-500"
                                      checked={checked}
                                      onChange={() => toggleClaimEvidence(idx, p.id)}
                                    />
                                    <span className="break-words">
                                      <span className="font-mono text-zinc-500">{p.type.toUpperCase()}</span>{" "}
                                      <span className="text-zinc-200">{p.label || "(unlabeled)"}</span>{" "}
                                      <span className="font-mono text-zinc-600">[{p.id}]</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-600 italic">Add evidence pointers first, then link them here.</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 italic">No claims yet. Add 3–7 core claims for AI triage.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Integrity Self-Report (for risk checks)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={selfReport.usesMl}
                      onChange={(e) => setSelfReport((p) => ({ ...p, usesMl: e.target.checked }))}
                    />
                    Uses ML / predictive modeling
                  </label>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">TRAIN_TEST_SPLIT</label>
                    <select
                      value={selfReport.trainTestSplit}
                      onChange={(e) => setSelfReport((p) => ({ ...p, trainTestSplit: e.target.value as SelfReport["trainTestSplit"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="na">N/A (theoretical)</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">PREREGISTERED</label>
                    <select
                      value={selfReport.preregistered}
                      onChange={(e) => setSelfReport((p) => ({ ...p, preregistered: e.target.value as SelfReport["preregistered"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">MULTIPLE_HYPOTHESES</label>
                    <select
                      value={selfReport.multipleHypotheses}
                      onChange={(e) => setSelfReport((p) => ({ ...p, multipleHypotheses: e.target.value as SelfReport["multipleHypotheses"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">POWER_ANALYSIS</label>
                    <select
                      value={selfReport.powerAnalysis}
                      onChange={(e) => setSelfReport((p) => ({ ...p, powerAnalysis: e.target.value as SelfReport["powerAnalysis"] }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="na">N/A</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">SAMPLE_SIZE (optional)</label>
                    <Input
                      type="number"
                      value={selfReport.sampleSize}
                      onChange={(e) => setSelfReport((p) => ({ ...p, sampleSize: e.target.value }))}
                      placeholder="e.g. 120"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Run AI Initial Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">ENGINE</label>
                    <div className="flex gap-2">
                      <Button size="sm" variant={engine === "auto" ? "emerald" : "outline"} onClick={() => setEngine("auto")}>
                        AUTO
                      </Button>
                      <Button size="sm" variant={engine === "simulated" ? "emerald" : "outline"} onClick={() => setEngine("simulated")}>
                        SIMULATED
                      </Button>
                    </div>
                    <div className="text-xs text-zinc-600">
                      AUTO uses Gemini if `GEMINI_API_KEY` is set; otherwise falls back to deterministic simulation.
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-mono text-zinc-500">AUTHOR_CONTEXT (optional)</label>
                    <textarea
                      value={userContext}
                      onChange={(e) => setUserContext(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[84px] focus:outline-none focus:border-emerald-500"
                      placeholder="Anything the reviewer must know (dataset notes, assumptions, scope boundaries, links)."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="emerald" onClick={() => void runInitialReview()} disabled={runStatus === "running"}>
                    {runStatus === "running" ? "RUNNING_T+10MIN..." : "RUN_AI_INITIAL_REVIEW"}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-zinc-700"
                    onClick={() => {
                      window.location.href = `/conclusion?paper=${encodeURIComponent(paper.id)}`;
                    }}
                  >
                    OPEN_CONCLUSION
                  </Button>
                  {runError ? <div className="text-sm text-red-400 font-mono">{runError}</div> : null}
                  {aiReviewAt ? (
                    <div className="text-xs font-mono text-zinc-600">
                      AI_REVIEW_AT: {new Date(aiReviewAt).toLocaleString()}
                    </div>
                  ) : null}
                  {defenseDeadlineAt ? (
                    <div className="text-xs font-mono text-zinc-600">
                      DEFENSE_DEADLINE: {new Date(defenseDeadlineAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triage" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Triage Radar & Risk Flags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 text-xs font-mono text-zinc-600">
                  <span>TRIAGE_SCORE: {Math.round(riskReport.summary.score * 100)}/100</span>
                  <span className="text-zinc-700">|</span>
                  <span>EVIDENCE_COVERAGE: {Math.round(riskReport.summary.evidenceCoverage * 100)}%</span>
                  <span className="text-zinc-700">|</span>
                  <span>TRACEABILITY: {Math.round(riskReport.summary.traceability * 100)}%</span>
                </div>

                <RadarChart
                  data={riskReport.axes.map((a) => ({ id: a.id, label: a.label, value: a.value }))}
                  className="max-w-3xl"
                />

                {riskReport.flags.length ? (
                  <div className="space-y-3">
                    {riskReport.flags.map((f) => (
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
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 italic">No risk flags detected from the current submission metadata.</div>
                )}
              </CardContent>
            </Card>

            <EpistemicReviewPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} defaultUserContext={reviewContext} />
          </TabsContent>

          <TabsContent value="defense" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Author Defense Window</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs font-mono text-zinc-500">T+72H RESPONSE DEADLINE</div>
                {defenseDeadlineAt ? (
                  <div className="text-sm text-zinc-300">
                    Time left:{" "}
                    <span className="font-mono text-emerald-500">
                      {timeLeft !== null && timeLeft > 0 ? formatDuration(timeLeft) : "0m 0s"}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">Run the initial review to start the defense window.</div>
                )}
              </CardContent>
            </Card>

            <SteelmanDefensePanel paper={paper} evidencePointers={evidencePointers} defaultUserContext={reviewContext} />
          </TabsContent>

          <TabsContent value="community" className="mt-6 space-y-6">
            <VerificationWorkOrdersPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
