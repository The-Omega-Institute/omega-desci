import { NextResponse } from "next/server";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import type { EpistemicReview } from "@/lib/review/epistemic";
import { computeRiskReport, type IntegritySelfReport, type RiskFlag } from "@/lib/review/risk";
import { computeConclusionVersion } from "@/lib/review/conclusion";
import { generateVerificationWorkOrders, type WorkOrdersStoreV1 } from "@/lib/review/verification";
import { applyRateLimit } from "@/lib/server/rateLimit";
import { scanSensitiveText } from "@/lib/server/safety";
import { enqueueJob } from "@/lib/server/queue";
import { makeReviewArtifact, putArtifact } from "@/lib/server/artifacts";
import { seedBountiesFromArtifact } from "@/lib/server/market";
import type { OmegaReviewClaimV1, OmegaReviewPayloadV1, OmegaReviewTestV1 } from "@/lib/review/protocol/types";

export const runtime = "nodejs";

type RequestBody = {
  paper: Paper;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
  userContext?: string;
  selfReport?: Partial<IntegritySelfReport>;
  engine?: "auto" | "simulated";
  enqueueReproQueue?: boolean;
};

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

function extractFallbackClaims(text: string) {
  const t = (text || "").trim();
  if (!t) return [];
  const sentences = t
    .split(/\n|[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  return sentences.slice(0, 6);
}

function dedupeFlags(flags: RiskFlag[]) {
  const seen = new Set<string>();
  const out: RiskFlag[] = [];
  for (const f of flags) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

function flattenTests(review: ReturnType<typeof computeConclusionVersion>): OmegaReviewTestV1[] {
  const out: OmegaReviewTestV1[] = [];
  for (const dim of review.rubric) {
    for (const t of dim.tests) {
      out.push({
        id: t.id,
        dimension: dim.id,
        label: t.label,
        status: t.status,
        detail: t.detail,
        fix: t.fix,
        weight: t.weight,
      });
    }
  }
  return out;
}

function normalizeText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function statusWeight(status: string) {
  if (status === "fail") return 3;
  if (status === "needs_evidence") return 2;
  if (status === "pass") return 1;
  return 0.5;
}

function controversyScore(row: EpistemicReview["alignment"][number]) {
  const base = statusWeight(row.status);
  const gaps = (row.gaps || []).length;
  const counter = (row.counterTests || []).length;
  const evidence = (row.evidence || []).length;
  return base + gaps * 0.35 + counter * 0.15 - evidence * 0.25;
}

function bountyRewardForPaper(paper: Paper) {
  if (paper.replicationBounty?.active) {
    const pool = Math.max(240, paper.replicationBounty.amountELF);
    return Math.max(90, Math.min(420, Math.round(pool / 6)));
  }
  return 180;
}

async function postJson<T>(url: URL, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstream engine error (${res.status})`);
  return (await res.json()) as T;
}

export async function POST(request: Request) {
  const rl = applyRateLimit(request, { key: "review_engine_v1", limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded.", resetAt: rl.resetAt },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": rl.resetAt,
        },
      }
    );
  }

  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paper = body?.paper;
  if (!paper || typeof paper !== "object" || !paper.id || !paper.title) {
    return NextResponse.json({ error: "Missing paper payload." }, { status: 400 });
  }

  const evidencePointers = Array.isArray(body.evidencePointers) ? body.evidencePointers : [];
  const claimEvidence = Array.isArray(body.claimEvidence) ? body.claimEvidence : [];
  const userContext = (body.userContext || "").trim();
  const engine = body.engine || "auto";
  const enqueueReproQueue = body.enqueueReproQueue !== false;

  const selfReport: IntegritySelfReport = { ...defaultSelfReport(), ...(body.selfReport || {}) };

  let epistemicReview: EpistemicReview;
  let attackSet: { id: string; attacks: unknown[] };
  try {
    const origin = new URL(request.url);
    const epistemicUrl = new URL("/api/review/epistemic", origin);
    const steelmanUrl = new URL("/api/review/steelman", origin);

    const epi = await postJson<{ review: EpistemicReview }>(epistemicUrl, { paper, engine, userContext, evidencePointers, claimEvidence });
    epistemicReview = epi.review;

    const sm = await postJson<{ attackSet: { id: string; attacks: unknown[] } }>(steelmanUrl, { paper, engine, userContext, evidencePointers });
    attackSet = sm.attackSet;
  } catch {
    const fallback = await import("@/lib/review/epistemic");
    const fallbackSteelman = await import("@/lib/review/steelman");
    epistemicReview = fallback.generateMockEpistemicReview(paper, { userContext, evidencePointers, claimEvidence });
    attackSet = fallbackSteelman.generateMockSteelmanAttackSet(paper, { userContext, evidencePointers });
  }

  const inferredClaims =
    claimEvidence.filter((c) => c.claim.trim().length > 0).length > 0
      ? claimEvidence.map((c, idx) => ({
          id: `clm-${idx + 1}`,
          claim: c.claim.trim(),
          evidenceIds: Array.isArray(c.evidenceIds) ? c.evidenceIds : [],
        }))
      : (epistemicReview.extracted?.claims || []).map((c, idx) => ({ id: `clm-${idx + 1}`, claim: c, evidenceIds: [] }));

  const fallback = !inferredClaims.length ? extractFallbackClaims(paper.abstract || "").map((c, idx) => ({ id: `clm-${idx + 1}`, claim: c, evidenceIds: [] })) : [];
  const claims: OmegaReviewClaimV1[] = (inferredClaims.length ? inferredClaims : fallback).filter((c) => c.claim.trim().length > 0);

  const risk = computeRiskReport({ paper, evidencePointers, claimEvidence, selfReport });
  const safetyText = [
    userContext,
    paper.title,
    paper.doi,
    paper.abstract,
    ...claims.map((c) => c.claim),
    ...evidencePointers.map((p) => [p.type, p.label, p.ref, p.url, p.doi, p.commit, p.hash, p.note].filter(Boolean).join(" ")),
  ]
    .filter(Boolean)
    .join("\n");
  const safetyFlags = scanSensitiveText(safetyText);
  const riskFlags = dedupeFlags([...risk.flags, ...safetyFlags]);

  const workOrders = generateVerificationWorkOrders({ paper, evidencePointers, claimEvidence });
  const workOrdersStore: WorkOrdersStoreV1 = {
    version: 1,
    paperId: paper.id,
    updatedAt: new Date().toISOString(),
    orders: workOrders,
    ledger: [],
  };

  const conclusion = computeConclusionVersion({
    id: "engine",
    versionLabel: "ENGINE",
    createdAt: new Date().toISOString(),
    paper,
    evidencePointers,
    claimEvidence,
    risk,
    epistemicReview,
    defenseEvaluation: null,
    selfReport,
    workOrdersStore,
  });

  const tests = flattenTests(conclusion);

  const evidenceIdsByClaim = new Map<string, string[]>();
  for (const c of claimEvidence) {
    const claim = normalizeText(c.claim || "");
    if (!claim) continue;
    evidenceIdsByClaim.set(claim, Array.isArray(c.evidenceIds) ? c.evidenceIds : []);
  }

  const ranked = (epistemicReview.alignment || [])
    .filter((r) => r.claim.trim().length > 0)
    .map((r) => ({
      claim: r.claim.trim(),
      status: r.status,
      gaps: (r.gaps || []).length,
      counterTests: (r.counterTests || []).length,
      evidence: (r.evidence || []).length,
      score: controversyScore(r),
      evidenceIds: evidenceIdsByClaim.get(normalizeText(r.claim)) || [],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const fallbackBounties =
    ranked.length > 0
      ? ranked
      : claims.slice(0, 3).map((c) => ({
          claim: c.claim,
          status: "needs_evidence" as const,
          gaps: 0,
          counterTests: 0,
          evidence: (c.evidenceIds || []).length,
          score: 1.25,
          evidenceIds: c.evidenceIds || [],
        }));

  const rewardELF = bountyRewardForPaper(paper);
  const stakeELF = Math.max(20, Math.round(rewardELF * 0.22));

  const tasks = fallbackBounties.map((b, idx) => {
    const title = `Bounty: reproduce controversial claim #${idx + 1}`;
    const id = `bounty-${idx + 1}`;

    if (!enqueueReproQueue) {
      return {
        id,
        kind: "reproduction_ticket" as const,
        status: "manual" as const,
        detail: title,
        claim: b.claim,
        alignmentStatus: b.status,
        controversyScore: Number(b.score.toFixed(2)),
        rewardELF,
        stakeELF,
        evidenceIds: b.evidenceIds,
        hints: {
          gaps: b.gaps,
          counterTests: b.counterTests,
          evidence: b.evidence,
        },
      };
    }

    const job = enqueueJob({
      type: "reproduction_ticket",
      input: {
        paperId: paper.id,
        bountyId: id,
        title,
        claim: b.claim,
        evidenceIds: b.evidenceIds,
      },
    });

    return {
      id,
      kind: "reproduction_ticket" as const,
      status: "queued" as const,
      queueJobId: job.id,
      detail: title,
      claim: b.claim,
      alignmentStatus: b.status,
      controversyScore: Number(b.score.toFixed(2)),
      rewardELF,
      stakeELF,
      evidenceIds: b.evidenceIds,
      hints: {
        gaps: b.gaps,
        counterTests: b.counterTests,
        evidence: b.evidence,
      },
    };
  });

  const payload: OmegaReviewPayloadV1 = {
    paper,
    claims,
    evidence: evidencePointers,
    tests: tests as OmegaReviewTestV1[],
    tasks,
    riskFlags,
    attacks: attackSet.attacks,
    sources: {
      engine,
      epistemicReviewId: epistemicReview.id,
      attackSetId: attackSet.id,
      workOrdersUpdatedAt: workOrdersStore.updatedAt,
    },
  };

  const artifact = makeReviewArtifact({ payload });
  putArtifact(artifact);
  await seedBountiesFromArtifact(artifact);

  return NextResponse.json(
    { artifact },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": rl.resetAt,
      },
    }
  );
}
