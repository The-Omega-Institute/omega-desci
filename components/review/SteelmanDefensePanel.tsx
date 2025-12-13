"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import type { EpistemicVerdict } from "@/lib/review/epistemic";
import type { EvidencePointer } from "@/lib/review/evidence";
import {
  evaluateDefenseResponses,
  generateMockSteelmanAttackSet,
  type DefenseEvaluation,
  type DefenseResponse,
  type SteelmanAttack,
  type SteelmanAttackSet,
} from "@/lib/review/steelman";
import { Badge, Button } from "@/components/ui/shadcn";

type SteelmanStoreV1 = {
  version: 1;
  attackSet: SteelmanAttackSet | null;
  responsesById: Record<string, string>;
  evaluation: DefenseEvaluation | null;
  userContext: string;
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

function severityBadgeVariant(severity: SteelmanAttack["severity"]) {
  if (severity === "high") return "destructive";
  if (severity === "medium") return "amber";
  return "muted";
}

function safeParseStore(raw: string | null): SteelmanStoreV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<SteelmanStoreV1>;
    if (obj.version !== 1) return null;
    return {
      version: 1,
      attackSet: (obj.attackSet as SteelmanAttackSet) || null,
      responsesById: (obj.responsesById as Record<string, string>) || {},
      evaluation: (obj.evaluation as DefenseEvaluation) || null,
      userContext: typeof obj.userContext === "string" ? obj.userContext : "",
    };
  } catch {
    return null;
  }
}

export function SteelmanDefensePanel({
  paper,
  evidencePointers,
  defaultUserContext,
}: {
  paper: Paper;
  evidencePointers?: EvidencePointer[];
  defaultUserContext?: string;
}) {
  const storageKey = useMemo(() => `omega_steelman_v1:${paper.id}`, [paper.id]);

  const [enginePref, setEnginePref] = useState<"auto" | "simulated">("auto");
  const [userContext, setUserContext] = useState(defaultUserContext || "");
  const [attackSet, setAttackSet] = useState<SteelmanAttackSet | null>(null);
  const [responsesById, setResponsesById] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<DefenseEvaluation | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "evaluating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const attacks = useMemo(() => attackSet?.attacks ?? [], [attackSet]);
  const respondedCount = useMemo(
    () => attacks.filter((a) => (responsesById[a.id] || "").trim().length > 0).length,
    [attacks, responsesById]
  );

  const evaluationByAttackId = useMemo(() => {
    const map = new Map<string, DefenseEvaluation["items"][number]>();
    for (const item of evaluation?.items || []) map.set(item.attackId, item);
    return map;
  }, [evaluation]);

  useEffect(() => {
    const stored = safeParseStore(localStorage.getItem(storageKey));
    if (!stored) return;
    setAttackSet(stored.attackSet);
    setResponsesById(stored.responsesById);
    setEvaluation(stored.evaluation);
    setUserContext(stored.userContext);
  }, [storageKey]);

  useEffect(() => {
    if (defaultUserContext && !userContext.trim()) setUserContext(defaultUserContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUserContext]);

  useEffect(() => {
    const payload: SteelmanStoreV1 = {
      version: 1,
      attackSet,
      responsesById,
      evaluation,
      userContext,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [attackSet, evaluation, responsesById, storageKey, userContext]);

  useEffect(() => {
    if (!attackSet) return;
    setResponsesById((prev) => {
      const next = { ...prev };
      for (const a of attackSet.attacks) {
        if (typeof next[a.id] !== "string") next[a.id] = "";
      }
      return next;
    });
  }, [attackSet]);

  const generateAttacks = async () => {
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/review/steelman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper, engine: enginePref, userContext, evidencePointers }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as { attackSet?: SteelmanAttackSet };
      if (!data.attackSet) throw new Error("Missing attackSet payload.");
      setAttackSet(data.attackSet);
      setEvaluation(null);
      setStatus("idle");
    } catch (err) {
      const local = generateMockSteelmanAttackSet(paper, { userContext, evidencePointers });
      setAttackSet(local);
      setEvaluation(null);
      const message = err instanceof Error ? err.message : "Failed to generate attacks.";
      setError(`Fell back to simulated steelman attacks (${message}).`);
      setStatus("error");
    }
  };

  const evaluateDefense = async () => {
    if (!attackSet) {
      setError("Generate steelman attacks first.");
      setStatus("error");
      return;
    }

    setStatus("evaluating");
    setError(null);

    const responses: DefenseResponse[] = attackSet.attacks.map((a) => ({
      attackId: a.id,
      response: responsesById[a.id] || "",
    }));

    try {
      const res = await fetch("/api/review/steelman/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper, attackSet, responses, engine: enginePref }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as { evaluation?: DefenseEvaluation };
      if (!data.evaluation) throw new Error("Missing evaluation payload.");
      setEvaluation(data.evaluation);
      setStatus("idle");
    } catch (err) {
      const local = evaluateDefenseResponses({ paper, attackSet, responses });
      setEvaluation(local);
      const message = err instanceof Error ? err.message : "Failed to evaluate defense.";
      setError(`Fell back to simulated scoring (${message}).`);
      setStatus("error");
    }
  };

  const clearAll = () => {
    localStorage.removeItem(storageKey);
    setAttackSet(null);
    setResponsesById({});
    setEvaluation(null);
    setUserContext("");
    setEnginePref("auto");
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
            <div className="text-xs font-mono text-emerald-500">STEELMAN_ATTACK_AND_DEFENSE</div>
            <div className="text-sm text-zinc-400">
              System generates the strongest rebuttals; author responds point-by-point; responses are scored for evidence alignment and counter-tests.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={enginePref === "auto" ? "emerald" : "outline"}
                className="h-8 font-mono text-xs"
                onClick={() => setEnginePref("auto")}
                disabled={status !== "idle"}
              >
                AUTO
              </Button>
              <Button
                size="sm"
                variant={enginePref === "simulated" ? "emerald" : "outline"}
                className="h-8 font-mono text-xs"
                onClick={() => setEnginePref("simulated")}
                disabled={status !== "idle"}
              >
                SIMULATED
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 font-mono text-xs border-zinc-700 border-dashed"
                onClick={() => void generateAttacks()}
                disabled={status !== "idle"}
              >
                {status === "generating" ? "GENERATING..." : attackSet ? "REGENERATE_ATTACKS" : "GENERATE_ATTACKS"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 font-mono text-xs border-zinc-700 border-dashed"
                onClick={() => void evaluateDefense()}
                disabled={status !== "idle" || !attackSet}
              >
                {status === "evaluating" ? "SCORING..." : "SCORE_DEFENSE"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 font-mono text-xs text-zinc-500 hover:text-white"
                onClick={clearAll}
                disabled={status !== "idle" && status !== "error"}
              >
                CLEAR
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-xs font-mono text-zinc-500">AUTHOR_CONTEXT (OPTIONAL)</div>
          <textarea
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            placeholder="Add key missing details (methods, thresholds, links, ablations). These will be used to generate stronger attacks and evaluate your defense."
            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[88px] focus:outline-none focus:border-emerald-500"
            disabled={status === "generating" || status === "evaluating"}
          />

          {evaluation ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="flex items-center gap-2">
                {verdictChip(evaluation.summary.verdict)}
                <span className="text-xs font-mono text-zinc-500">DEFENSE_SCORE: {Math.round(evaluation.overallScore * 100)}/100</span>
                <span className="text-xs font-mono text-zinc-600">
                  RESPONDED: {respondedCount}/{attacks.length}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-600">
                ENGINE: {evaluation.engine.toUpperCase()} / {evaluation.model}
              </div>
            </div>
          ) : attackSet ? (
            <div className="pt-2 text-xs font-mono text-zinc-600">
              ATTACKS_READY: {attacks.length} • RESPONDED: {respondedCount}/{attacks.length} • ENGINE: {attackSet.engine.toUpperCase()} / {attackSet.model}
            </div>
          ) : null}

          {error && <div className="text-xs font-mono text-amber-500">NOTICE: {error}</div>}
        </div>
      </div>

      {!attackSet ? (
        <div className="border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-500 italic">
          No steelman attacks yet. Generate attacks to start the adversarial defense loop.
        </div>
      ) : (
        <div className="space-y-4">
          {attacks.map((attack, idx) => {
            const item = evaluationByAttackId.get(attack.id);
            return (
              <div key={attack.id} className="border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityBadgeVariant(attack.severity)} className="font-mono text-[10px] px-2 py-0.5">
                        {attack.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 border-zinc-700 text-zinc-400">
                        {attack.category.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-mono text-zinc-600">ATTACK #{idx + 1}</span>
                      {item ? (
                        <>
                          {verdictChip(item.verdict)}
                          <span className="text-xs font-mono text-zinc-500">SCORE: {Math.round(item.score * 100)}/100</span>
                        </>
                      ) : null}
                    </div>
                    <div className="text-sm font-semibold text-zinc-100">{attack.title}</div>
                    <div className="text-xs font-mono text-zinc-600">TARGET: {attack.target}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-zinc-300 whitespace-pre-line">{attack.attack}</div>

                {attack.counterTests.length ? (
                  <div className="mt-3 border border-zinc-800 bg-black/30 p-3">
                    <div className="text-[10px] font-mono text-zinc-600 mb-1">COUNTER_TESTS</div>
                    <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                      {attack.counterTests.map((t, j) => (
                        <li key={j} className="break-words">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-mono text-zinc-500">AUTHOR_RESPONSE</div>
                  <textarea
                    value={responsesById[attack.id] || ""}
                    onChange={(e) =>
                      setResponsesById((prev) => ({
                        ...prev,
                        [attack.id]: e.target.value,
                      }))
                    }
                    placeholder="Respond directly to this attack. Include evidence links/citations and propose a concrete counter-test or threshold."
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                    disabled={status === "generating" || status === "evaluating"}
                  />
                </div>

                {item ? (
                  <div className="mt-4 border border-zinc-800 bg-black/30 p-3 space-y-3">
                    <div className="text-[10px] font-mono text-zinc-600">SCORING_RATIONALE</div>
                    <div className="text-sm text-zinc-400">{item.rationale}</div>

                    {item.missing.length ? (
                      <div>
                        <div className="text-[10px] font-mono text-zinc-600 mb-1">MISSING</div>
                        <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                          {item.missing.map((m, j) => (
                            <li key={j} className="break-words">
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.evidenceUsed.length ? (
                      <div>
                        <div className="text-[10px] font-mono text-zinc-600 mb-1">EVIDENCE_USED</div>
                        <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                          {item.evidenceUsed.map((e, j) => (
                            <li key={j} className="break-words">
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.proposedTests.length ? (
                      <div>
                        <div className="text-[10px] font-mono text-zinc-600 mb-1">PROPOSED_TESTS</div>
                        <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                          {item.proposedTests.map((t, j) => (
                            <li key={j} className="break-words">
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
