"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import { generateMockEpistemicReview, type EpistemicReview, type EpistemicVerdict } from "@/lib/review/epistemic";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { Badge, Button } from "@/components/ui/shadcn";

type ReviewStoreV2 = {
  version: 2;
  activeId: string | null;
  runs: EpistemicReview[];
};

const verdictMeta: Record<
  EpistemicVerdict,
  { label: string; badgeVariant: "emerald" | "amber" | "destructive" | "muted" }
> = {
  pass: { label: "PASS", badgeVariant: "emerald" },
  needs_evidence: { label: "NEEDS_EVIDENCE", badgeVariant: "amber" },
  fail: { label: "FAIL", badgeVariant: "destructive" },
  na: { label: "N/A", badgeVariant: "muted" },
};

function safeParseStore(raw: string | null): ReviewStoreV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<ReviewStoreV2>;
    if (obj.version !== 2) return null;
    if (!Array.isArray(obj.runs)) return null;
    return {
      version: 2,
      activeId: typeof obj.activeId === "string" ? obj.activeId : null,
      runs: obj.runs as EpistemicReview[],
    };
  } catch {
    return null;
  }
}

export function EpistemicReviewPanel({
  paper,
  evidencePointers,
  claimEvidence,
  defaultUserContext,
}: {
  paper: Paper;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
  defaultUserContext?: string;
}) {
  const storageKey = useMemo(() => `omega_epistemic_review_v2:${paper.id}`, [paper.id]);

  const [runs, setRuns] = useState<EpistemicReview[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [enginePref, setEnginePref] = useState<"auto" | "simulated">("auto");
  const [userContext, setUserContext] = useState(defaultUserContext || "");
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const activeReview = useMemo(() => {
    if (!runs.length) return null;
    if (activeId) return runs.find((r) => r.id === activeId) || runs[runs.length - 1];
    return runs[runs.length - 1];
  }, [activeId, runs]);

  useEffect(() => {
    const stored = safeParseStore(localStorage.getItem(storageKey));
    if (!stored) {
      setRuns([]);
      setActiveId(null);
      return;
    }
    setRuns(stored.runs);
    setActiveId(stored.activeId);
  }, [storageKey]);

  useEffect(() => {
    if (defaultUserContext && !userContext.trim()) setUserContext(defaultUserContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUserContext]);

  useEffect(() => {
    const payload: ReviewStoreV2 = { version: 2, activeId, runs };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [activeId, runs, storageKey]);

  const runEpistemicLoop = async () => {
    setStatus("running");
    setError(null);

    try {
      const res = await fetch("/api/review/epistemic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          engine: enginePref,
          userContext,
          evidencePointers,
          claimEvidence,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = (await res.json()) as { review?: EpistemicReview };
      if (!data.review) throw new Error("Missing review payload.");

      setRuns((prev) => [...prev, data.review as EpistemicReview]);
      setActiveId(data.review.id);
      setStatus("idle");
    } catch (err) {
      const local = generateMockEpistemicReview(paper, { userContext, evidencePointers, claimEvidence });
      setRuns((prev) => [...prev, local]);
      setActiveId(local.id);
      const message = err instanceof Error ? err.message : "Failed to run review.";
      setError(`Fell back to simulated rubric (${message}).`);
      setStatus("error");
    }
  };

  const clearRuns = () => {
    localStorage.removeItem(storageKey);
    setRuns([]);
    setActiveId(null);
    setError(null);
    setStatus("idle");
  };

  const verdictChip = (v: EpistemicVerdict) => {
    const meta = verdictMeta[v];
    return (
      <Badge variant={meta.badgeVariant} className="font-mono text-[10px] px-2 py-0.5">
        {meta.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-mono text-emerald-500">AI_AUGMENTED_REVIEW_LOOP</div>
            <div className="text-sm text-zinc-400">
              Structured epistemic rubric output (Pass / Needs Evidence / Fail) with actionable tests and follow-ups.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={enginePref === "auto" ? "emerald" : "outline"}
                className="h-8 font-mono text-xs"
                onClick={() => setEnginePref("auto")}
                disabled={status === "running"}
              >
                AUTO
              </Button>
              <Button
                size="sm"
                variant={enginePref === "simulated" ? "emerald" : "outline"}
                className="h-8 font-mono text-xs"
                onClick={() => setEnginePref("simulated")}
                disabled={status === "running"}
              >
                SIMULATED
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 font-mono text-xs border-zinc-700 border-dashed"
                onClick={() => void runEpistemicLoop()}
                disabled={status === "running"}
              >
                {status === "running" ? "RUNNING..." : runs.length ? "RUN_NEXT_ITERATION" : "RUN_REVIEW"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 font-mono text-xs text-zinc-500 hover:text-white"
                onClick={clearRuns}
                disabled={status === "running" || runs.length === 0}
              >
                CLEAR
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-xs font-mono text-zinc-500">ADDITIONAL_CONTEXT (OPTIONAL)</div>
          <textarea
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            placeholder="Paste key details not present in the abstract (e.g., repo link, methods summary, ablations, thresholds)."
            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[88px] focus:outline-none focus:border-emerald-500"
            disabled={status === "running"}
          />
          {error && <div className="text-xs font-mono text-red-400">ERROR: {error}</div>}
        </div>
      </div>

      {runs.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-xs font-mono text-zinc-600 mr-2">ITERATIONS:</div>
          {runs.map((r, idx) => (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === activeId ? "emerald" : "outline"}
              className="h-7 px-2 font-mono text-[10px]"
              onClick={() => setActiveId(r.id)}
              disabled={status === "running"}
            >
              #{idx + 1}
            </Button>
          ))}
        </div>
      )}

      {!activeReview ? (
        <div className="border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-500 italic">
          No epistemic review yet. Run the loop to generate a structured critique.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {verdictChip(activeReview.summary.verdict)}
                <span className="text-xs font-mono text-zinc-500">
                  CONFIDENCE: {Math.round(activeReview.summary.confidence * 100)}%
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-600">
                ENGINE: {activeReview.engine.toUpperCase()} / {activeReview.model}
              </div>
            </div>

            <div className="mt-3 text-sm text-zinc-300">{activeReview.summary.oneLine}</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-zinc-800 bg-black/30 p-3">
                <div className="text-xs font-mono text-zinc-500 mb-2">EXTRACTED_CLAIMS</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                  {activeReview.extracted.claims.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-zinc-800 bg-black/30 p-3">
                <div className="text-xs font-mono text-zinc-500 mb-2">ASSUMPTIONS</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                  {activeReview.extracted.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-zinc-800 bg-black/30 p-3">
                <div className="text-xs font-mono text-zinc-500 mb-2">TESTABLE_PREDICTIONS</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                  {activeReview.extracted.testablePredictions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 border border-zinc-800 bg-black/30 p-3">
              <div className="text-xs font-mono text-zinc-500 mb-2">CLAIM_EVIDENCE_MATRIX</div>
              <div className="space-y-3">
                {activeReview.alignment.map((row, idx) => (
                  <div key={idx} className="border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm text-zinc-200 font-semibold">{row.claim}</div>
                        {verdictChip(row.status)}
                      </div>
                      {row.evidence.length ? (
                        <div className="mt-2">
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
                        <div className="mt-2">
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
                        <div className="mt-2">
                          <div className="text-[10px] font-mono text-zinc-600 mb-1">COUNTER_TESTS</div>
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
            </div>
          </div>

          <div className="space-y-3">
            {activeReview.sections.map((section) => (
              <div key={section.id} className="border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-xs font-mono text-emerald-500 mb-3">{section.title.toUpperCase()}</div>
                <div className="space-y-3">
                  {section.checks.map((check) => (
                    <div key={check.id} className="border border-zinc-800 bg-black/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm text-zinc-200 font-semibold">{check.label}</div>
                        {verdictChip(check.verdict)}
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">{check.rationale}</div>

                      {check.evidence?.length ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-mono text-zinc-600 mb-1">EVIDENCE</div>
                          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                            {check.evidence.map((e, idx) => (
                              <li key={idx} className="break-words">
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {check.counterTests?.length ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-mono text-zinc-600 mb-1">COUNTER_TESTS</div>
                          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                            {check.counterTests.map((t, idx) => (
                              <li key={idx} className="break-words">
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {check.followups?.length ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-mono text-zinc-600 mb-1">FOLLOW_UPS</div>
                          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                            {check.followups.map((f, idx) => (
                              <li key={idx} className="break-words">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs font-mono text-emerald-500 mb-3">ACTION_ITEMS</div>
              <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                {activeReview.actionItems.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs font-mono text-zinc-500 mb-3">LIMITATIONS</div>
              <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                {activeReview.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-[10px] font-mono text-zinc-600">
            GENERATED_AT: {new Date(activeReview.createdAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
