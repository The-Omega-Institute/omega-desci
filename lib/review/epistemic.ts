import type { Paper } from "@/lib/mockData";
import { formatEvidencePointer, type ClaimEvidence, type EvidencePointer } from "@/lib/review/evidence";

export type EpistemicVerdict = "pass" | "needs_evidence" | "fail" | "na";

export type EpistemicCheck = {
  id: string;
  label: string;
  verdict: EpistemicVerdict;
  rationale: string;
  evidence?: string[];
  counterTests?: string[];
  followups?: string[];
};

export type EpistemicSection = {
  id: string;
  title: string;
  checks: EpistemicCheck[];
};

export type EpistemicReview = {
  id: string;
  rubricVersion: string;
  engine: "simulated" | "gemini";
  model: string;
  paperId: string;
  createdAt: string;
  summary: {
    verdict: EpistemicVerdict;
    confidence: number;
    oneLine: string;
  };
  alignment: Array<{
    claim: string;
    status: EpistemicVerdict;
    evidence: string[];
    gaps: string[];
    counterTests: string[];
  }>;
  extracted: {
    claims: string[];
    assumptions: string[];
    testablePredictions: string[];
  };
  sections: EpistemicSection[];
  actionItems: string[];
  limitations: string[];
};

type DeterministicRng = () => number;

function hashStringToUint32(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): DeterministicRng {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: DeterministicRng, items: readonly T[]) {
  return items[Math.floor(rng() * items.length)];
}

function pickMany<T>(rng: DeterministicRng, items: readonly T[], count: number) {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length > 0 && out.length < count) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function verdictFromSignals(signals: {
  hasFalsifiability: boolean;
  hasArtifacts: boolean;
  hasMethodsLanguage: boolean;
  isVeryShort: boolean;
}) {
  if (signals.isVeryShort) return "needs_evidence" as const;
  if (signals.hasFalsifiability && signals.hasArtifacts && signals.hasMethodsLanguage) return "pass" as const;
  if (!signals.hasFalsifiability && !signals.hasArtifacts) return "needs_evidence" as const;
  return "needs_evidence" as const;
}

export function generateMockEpistemicReview(
  paper: Paper,
  opts?: { userContext?: string; evidencePointers?: EvidencePointer[]; claimEvidence?: ClaimEvidence[] }
) {
  const userContext = (opts?.userContext || "").trim();
  const evidencePointers = opts?.evidencePointers || [];
  const claimEvidence = (opts?.claimEvidence || []).filter((c) => c.claim.trim().length > 0);
  const seedSource = `${paper.id}|${paper.doi}|${paper.title}|${paper.authors.map((a) => a.name).join(",")}`;
  const rng = mulberry32(hashStringToUint32(seedSource));

  const abstract = (paper.abstract || "").trim();
  const abstractLen = abstract.length;
  const isVeryShort = abstractLen > 0 && abstractLen < 240;
  const hasMethodsLanguage = /we\s+(propose|present|introduce|derive|show|demonstrate|evaluate|simulate|test)/i.test(abstract);
  const hasFalsifiability = (paper.falsifiabilityPath || "").trim().toLowerCase() !== "n/a" && (paper.falsifiabilityPath || "").trim().length > 24;
  const hasArtifacts = Boolean(paper.codeAvailable || paper.dataAvailable);

  const topVerdict = verdictFromSignals({ hasFalsifiability, hasArtifacts, hasMethodsLanguage, isVeryShort });

  const passWeight = (paper.codeAvailable ? 0.15 : 0) + (paper.dataAvailable ? 0.1 : 0) + (hasFalsifiability ? 0.2 : 0) + (hasMethodsLanguage ? 0.15 : 0);
  const contextBoost = userContext ? 0.1 : 0;
  const confidence = clamp01(0.45 + passWeight + contextBoost - (isVeryShort ? 0.15 : 0));

  const claims = [
    `Primary claim: ${paper.title}.`,
    pick(rng, [
      "The paper asserts a mechanistic link between the proposed model and an observable signature.",
      "The paper argues that an information-theoretic constraint explains the reported phenomenon.",
      "The paper claims the effect persists across parameter ranges relevant to the stated scope.",
      "The paper proposes a unifying principle that subsumes several previously separate results.",
    ]),
    pick(rng, [
      "If the core assumptions hold, the central result should be reproducible under the described conditions.",
      "The strongest claim appears to be conditional and should be restated with explicit boundaries.",
      "The work implicitly treats the chosen representation as physically meaningful; this should be defended.",
      "The manuscript's contribution hinges on a specific definition; alternative definitions may alter conclusions.",
    ]),
  ];

  const providedClaims = claimEvidence.map((c) => c.claim);
  const extractedClaims = providedClaims.length ? providedClaims : claims;

  const assumptions = pickMany(
    rng,
    [
      "The chosen discretization/representation is faithful to the underlying physical quantity of interest.",
      "Boundary/initial conditions do not dominate the reported effect.",
      "The model's parameterization is identifiable from available measurements/simulations.",
      "Observed correlations are not artifacts of preprocessing or selection.",
      "The proposed mapping between information and dynamics is well-defined and conserved under updates.",
      "Claims are robust to reasonable alternative priors / hyperparameters.",
    ],
    3
  );

  const predictions = pickMany(
    rng,
    [
      "A pre-registered replication with blinded analysis should recover the effect size within confidence bounds.",
      "A control variant (ablation) should eliminate the effect if the claimed mechanism is correct.",
      "Scaling the system size should change the signal according to the stated law (e.g., linear/log).",
      "Swapping to an alternative estimator should preserve the qualitative conclusion.",
      "If assumptions fail, the proposed signature should not appear beyond baseline noise.",
    ],
    3
  );

  const baseEvidence: string[] = [];
  if (paper.doi) baseEvidence.push(`DOI: ${paper.doi}`);
  if (paper.codeAvailable && paper.codeUrl) {
    baseEvidence.push(`Code: ${paper.codeUrl}${paper.codeHash ? ` (commit/hash: ${paper.codeHash})` : ""}`);
  }
  if (paper.dataAvailable) baseEvidence.push("Data: available (per record metadata/files).");
  if (hasFalsifiability) baseEvidence.push(`Falsifiability path: ${paper.falsifiabilityPath}`);
  if (userContext) baseEvidence.push("Author-supplied context provided for this run.");

  const evidencePointerStrings = evidencePointers.map((p) => formatEvidencePointer(p));
  const evidence = Array.from(new Set<string>([...baseEvidence, ...evidencePointerStrings]));

  const pointerById = new Map(evidencePointers.map((p) => [p.id, p] as const));

  const alignment = claimEvidence.length
    ? claimEvidence.slice(0, 8).map((c) => {
        const linked = c.evidenceIds
          .map((id) => pointerById.get(id))
          .filter((p): p is EvidencePointer => Boolean(p));
        const linkedStrings = linked.map((p) => formatEvidencePointer(p));
        const rowEvidence = Array.from(new Set<string>([...baseEvidence, ...linkedStrings]));

        const gaps: string[] = [];
        if (!linked.length) gaps.push("No evidence pointers linked to this claim.");
        if (!hasFalsifiability) gaps.push("No explicit falsifiability threshold at record level.");
        if (!paper.codeAvailable) gaps.push("No code artifact detected.");
        if (!paper.dataAvailable) gaps.push("No data artifact detected (may be theoretical).");
        if (!hasMethodsLanguage) gaps.push("Methods/operational definitions not verifiable from abstract alone.");

        for (const p of linked) {
          if (p.type === "code" && !p.commit && !p.hash) gaps.push("Code evidence pointer missing commit/hash.");
          if (p.type === "data" && !p.hash && !p.doi) gaps.push("Data evidence pointer missing hash/DOI.");
          if ((p.type === "figure" || p.type === "table") && !p.ref) gaps.push(`${p.type.toUpperCase()} evidence pointer missing reference.`);
        }

        const counterTests = [
          hasFalsifiability
            ? `Attempt falsification exactly as specified: ${paper.falsifiabilityPath}`
            : "Define a thresholded negative control that should break the claimed effect.",
          "Run an ablation that removes the claimed mechanism; effect should disappear if causal.",
          "Swap estimator/metric; claim should remain qualitatively stable if robust.",
        ];

        const status: EpistemicVerdict = gaps.length === 0 ? "pass" : "needs_evidence";

        return {
          claim: c.claim,
          status,
          evidence: rowEvidence,
          gaps,
          counterTests,
        };
      })
    : pickMany(rng, extractedClaims, Math.min(2, extractedClaims.length)).map((c) => {
        const gaps: string[] = [];
        if (!hasFalsifiability) gaps.push("No explicit falsifiability threshold at record level.");
        if (!paper.codeAvailable) gaps.push("No code artifact detected.");
        if (!paper.dataAvailable) gaps.push("No data artifact detected (may be theoretical).");
        if (!hasMethodsLanguage) gaps.push("Methods/operational definitions not verifiable from abstract alone.");

        const counterTests = [
          hasFalsifiability
            ? `Attempt falsification exactly as specified: ${paper.falsifiabilityPath}`
            : "Define a thresholded negative control that should break the claimed effect.",
          "Run an ablation that removes the claimed mechanism; effect should disappear if causal.",
          "Swap estimator/metric; claim should remain qualitatively stable if robust.",
        ];

        const status: EpistemicVerdict = gaps.length === 0 ? "pass" : "needs_evidence";

        return {
          claim: c,
          status,
          evidence,
          gaps,
          counterTests,
        };
      });

  const sections: EpistemicSection[] = [
    {
      id: "value",
      title: "Problem Value & Framing",
      checks: [
        {
          id: "value.why_now",
          label: "The question is valuable (not just novel)",
          verdict: "needs_evidence",
          rationale:
            "Value depends on comparative baselines and domain impact; record-level metadata rarely provides this explicitly.",
          evidence: abstractLen ? ["Abstract/description present."] : undefined,
          counterTests: [
            "If the main claim were false, would any useful insight remain (tooling, dataset, theorem)?",
            "Compare against 3 closest prior works and show a measurable delta (accuracy, runtime, scope, falsifiability).",
          ],
          followups: ["State the stakeholder and the measurable benefit (what changes if this is true?)."],
        },
        {
          id: "value.problem_statement",
          label: "Problem statement is crisp and scoped",
          verdict: abstractLen ? (isVeryShort ? "needs_evidence" : "pass") : "needs_evidence",
          rationale: abstractLen
            ? isVeryShort
              ? "Abstract is short; the problem statement may exist but not crisply scoped."
              : "The record contains enough text to infer a scoped problem statement."
            : "No abstract provided; cannot verify scoping.",
          counterTests: ["Rewrite the problem as a yes/no question; if that changes the meaning, it is underspecified."],
          followups: ["Rewrite: 1 sentence problem + 1 sentence scope boundary + 1 sentence non-goal."],
        },
      ],
    },
    {
      id: "claims",
      title: "Claim Clarity & Scope",
      checks: [
        {
          id: "claims.core",
          label: "Core claim is stated explicitly",
          verdict: abstractLen ? (isVeryShort ? "needs_evidence" : "pass") : "needs_evidence",
          rationale: abstractLen
            ? isVeryShort
              ? "Abstract is short; the core claim may be present but not operationally precise."
              : "The abstract provides enough surface structure to extract a central claim."
            : "No abstract provided; cannot verify claim clarity.",
          evidence: abstractLen ? ["Abstract/description text present in record."] : undefined,
          counterTests: [
            "Ask two independent readers to restate the claim; if they disagree on the measurable target, clarity is insufficient.",
          ],
          followups: ["Rewrite the central claim as 1 sentence + 3 measurable terms."],
        },
        {
          id: "claims.boundary",
          label: "Scope boundaries and failure conditions are explicit",
          verdict: hasFalsifiability ? "pass" : "needs_evidence",
          rationale: hasFalsifiability
            ? "A falsifiability path is provided, which implies at least one failure condition."
            : "No explicit falsifiability/failure condition found in the record.",
          evidence: hasFalsifiability ? [`${paper.falsifiabilityPath}`] : undefined,
          counterTests: ["Define the strongest plausible counterexample and show whether the claim survives it."],
          followups: ["State what result would falsify the claim and what would merely weaken it."],
        },
      ],
    },
    {
      id: "falsifiability",
      title: "Falsifiability & Prediction Quality",
      checks: [
        {
          id: "falsifiability.threshold",
          label: "Predictions have thresholds (not just directionality)",
          verdict: hasFalsifiability ? "pass" : "needs_evidence",
          rationale: hasFalsifiability
            ? "A threshold-like falsifiability path is present."
            : "No explicit thresholded prediction detected; add one (effect size, p-value, error bound, etc.).",
          evidence: hasFalsifiability ? [`${paper.falsifiabilityPath}`] : undefined,
          counterTests: ["Run a negative control where the mechanism is removed; prediction should fail."],
          followups: ["Specify effect size, acceptance threshold, and expected variance."],
        },
        {
          id: "falsifiability.alternatives",
          label: "Alternative explanations are enumerated",
          verdict: "needs_evidence",
          rationale: "Alternative hypotheses are not verifiable from record-level text alone.",
          counterTests: ["List 3 alternative mechanisms and propose a discriminating test for each."],
          followups: ["Add an 'alternative explanations' section with discriminating tests."],
        },
      ],
    },
    {
      id: "evidence",
      title: "Evidence Chain Density",
      checks: [
        {
          id: "evidence.mapping",
          label: "Each major claim is mapped to supporting evidence",
          verdict: evidence.length >= 3 ? "needs_evidence" : "needs_evidence",
          rationale:
            "This demo can detect some artifacts (DOI/code/data), but claim→evidence mapping needs manuscript-level citations or extracted excerpts.",
          evidence,
          counterTests: ["Remove one evidence link; if the conclusion still stands, the chain may be redundant/robust."],
          followups: ["Provide a claim→figure/table mapping (or DOI section mapping) for auditability."],
        },
      ],
    },
    {
      id: "methods",
      title: "Methods & Identifiability",
      checks: [
        {
          id: "methods.operationalization",
          label: "Key constructs are operationalized",
          verdict: hasMethodsLanguage ? "needs_evidence" : "needs_evidence",
          rationale: hasMethodsLanguage
            ? "Methods language is present, but operational definitions are not verifiable from the abstract alone."
            : "No clear methods language in the abstract; operationalization likely under-specified at record level.",
          counterTests: [
            "Replace each construct with a measurable proxy; if the claim changes meaning, operationalization is missing.",
          ],
          followups: [
            "List the measurable variables/estimators used for each key term (e.g., “information rate”).",
            "Provide the minimal algorithm/pseudocode needed to reproduce the main figure.",
          ],
        },
        {
          id: "methods.controls",
          label: "Controls/ablations are specified",
          verdict: "needs_evidence",
          rationale: "Controls are rarely inferable from metadata-only ingestion; requires manuscript detail.",
          counterTests: ["Propose a control that would produce the same output if the claim is spurious."],
          followups: ["Describe 2 negative controls + 1 ablation that should break the result."],
        },
      ],
    },
    {
      id: "robustness",
      title: "Method Robustness",
      checks: [
        {
          id: "robustness.sensitivity",
          label: "Sensitivity analysis / hyperparameter robustness is provided",
          verdict: "needs_evidence",
          rationale: "Robustness requires parameter sweeps or perturbation tests; not verifiable from record-level metadata.",
          counterTests: ["Perturb key parameters by ±10% and verify the conclusion remains."],
          followups: ["Add a sensitivity/ablation appendix with plots and failure regions."],
        },
        {
          id: "robustness.statistics",
          label: "Statistical / uncertainty reporting is appropriate",
          verdict: "needs_evidence",
          rationale: "Uncertainty reporting (CIs, error bars, priors) is not inspectable from metadata alone.",
          counterTests: ["Recompute with a different uncertainty estimator; conclusions should persist."],
          followups: ["Report uncertainty and specify what randomness sources exist (seed, sampling, measurement)."],
        },
      ],
    },
    {
      id: "leakage",
      title: "Data Leakage & Contamination Risk",
      checks: [
        {
          id: "leakage.split",
          label: "Train/test separation prevents leakage (if applicable)",
          verdict: "na",
          rationale:
            "Leakage applies mainly to empirical/ML datasets; this demo cannot infer dataset pipelines from metadata-only ingestion.",
          counterTests: ["Attempt a leakage audit: ensure no overlap in identifiers/hashes across splits."],
          followups: ["If ML: document dataset lineage + de-duplication + contamination checks."],
        },
        {
          id: "leakage.preprocess",
          label: "Preprocessing does not leak target information",
          verdict: "na",
          rationale: "Requires pipeline detail to evaluate.",
          counterTests: ["Re-run with preprocessing fit on train-only; compare performance."],
          followups: ["Provide a pipeline diagram with 'fit' vs 'transform' boundaries."],
        },
      ],
    },
    {
      id: "repro",
      title: "Reproducibility Artifacts",
      checks: [
        {
          id: "repro.code",
          label: "Code is accessible and referenced",
          verdict: paper.codeAvailable ? "pass" : "needs_evidence",
          rationale: paper.codeAvailable ? "A repository link was detected." : "No repository link detected in record metadata/description.",
          evidence: paper.codeAvailable && paper.codeUrl ? [paper.codeUrl] : undefined,
          counterTests: ["Reproduce from a clean environment using only the pinned artifact; deviations indicate hidden dependencies."],
          followups: paper.codeAvailable ? ["Pin a commit hash + environment spec (Docker/conda)."] : ["Add a public repo link or an archived code snapshot."],
        },
        {
          id: "repro.data",
          label: "Data/inputs are accessible (or clearly not applicable)",
          verdict: paper.dataAvailable ? "pass" : "needs_evidence",
          rationale: paper.dataAvailable ? "Record appears to include data-like files or artifacts." : "No data-like artifacts detected; may be theoretical or missing uploads.",
          counterTests: ["Attempt reproduction using only referenced inputs; if missing, reproduction is not auditable."],
          followups: ["If theoretical: provide executable notebook + parameter sweep outputs used in the paper."],
        },
        {
          id: "repro.license",
          label: "Licensing enables reuse",
          verdict: "needs_evidence",
          rationale: "License is not evaluated in the demo rubric; confirm OSI/CC terms for code/data reuse.",
          counterTests: ["If code/data cannot legally be reused, the platform should treat the work as non-reproducible by default."],
          followups: ["Explicitly state license for code, data, and manuscript."],
        },
      ],
    },
    {
      id: "causality",
      title: "Causal Identification (if causal claims exist)",
      checks: [
        {
          id: "causality.claims_match_design",
          label: "Causal claims match the identification strategy",
          verdict: "needs_evidence",
          rationale: "Causal validity requires design detail (randomization, interventions, confounders).",
          counterTests: ["Try to explain the result with a confounder; if plausible, causal claim is weak."],
          followups: ["State the identification strategy and the assumptions required for causality."],
        },
      ],
    },
    {
      id: "related",
      title: "Related Work & Baselines",
      checks: [
        {
          id: "related.baselines",
          label: "Baselines/prior art are compared fairly",
          verdict: "needs_evidence",
          rationale: "Baseline comparison is not available from record-level metadata.",
          counterTests: ["Re-run comparisons with stronger baselines; if advantage disappears, novelty is overstated."],
          followups: ["List top 3 closest works + 1 quantitative comparison per claim."],
        },
      ],
    },
    {
      id: "ethics",
      title: "Social Risk & Ethics",
      checks: [
        {
          id: "ethics.dual_use",
          label: "Dual-use or misuse risks are considered (if applicable)",
          verdict: "na",
          rationale: "Risk assessment is context-dependent and usually not stated in record-level metadata.",
          counterTests: ["If misuse is plausible, require a mitigation plan before promotion."],
          followups: ["Add a short risk statement: who could be harmed and how to mitigate."],
        },
      ],
    },
  ];

  const actionItems = [
    "Rewrite the central claim with explicit observables + boundaries.",
    "List assumptions; mark which are empirically testable vs. definitional.",
    paper.codeAvailable ? "Pin code to a commit + provide a one-command run script." : "Add a code artifact (repo link or archived snapshot).",
    paper.dataAvailable ? "Add a minimal reproduction recipe for the included artifacts." : "Upload or link the minimal input data (or explain why N/A).",
    hasFalsifiability ? "Convert falsifiability path into a pre-registered replication bounty spec." : "Add a falsifiable prediction with threshold + negative control.",
  ];

  return {
    id: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,
    rubricVersion: "epistemic-rubric-v1",
    engine: "simulated",
    model: "simulated-epistemic-v1",
    paperId: paper.id,
    createdAt: new Date().toISOString(),
    summary: {
      verdict: topVerdict,
      confidence: Number(confidence.toFixed(2)),
      oneLine: pick(rng, [
        "Structured rubric run completed; most gaps are evidentiary rather than contradictory.",
        "Rubric indicates missing operational definitions and replication protocol detail.",
        "Record-level metadata supports the claim framing, but key tests need explicit thresholds.",
        "Main risks: underspecified controls and unclear boundary conditions.",
      ]),
    },
    alignment,
    extracted: {
      claims: extractedClaims,
      assumptions,
      testablePredictions: predictions,
    },
    sections,
    actionItems,
    limitations: [
      "This demo run only ingests record-level metadata (title/abstract/artifacts), not the full PDF.",
      "Verdicts are heuristic and should be treated as prompts for verification, not authoritative judgments.",
      userContext
        ? "User-provided context may be incomplete or biased; corroborate with primary sources."
        : "Supplying links to the manuscript/code can increase review specificity.",
    ],
  } satisfies EpistemicReview;
}
