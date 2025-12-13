import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import type { EpistemicReview, EpistemicVerdict } from "@/lib/review/epistemic";
import type { RiskReport } from "@/lib/review/risk";
import type { DefenseEvaluation } from "@/lib/review/steelman";
import type { IntegritySelfReport } from "@/lib/review/risk";
import type { WorkOrdersStoreV1 } from "@/lib/review/verification";

export type AutoTest = {
  id: string;
  label: string;
  status: EpistemicVerdict;
  detail: string;
  fix?: string;
  weight?: number; // default 1
};

export type RubricDimensionId =
  | "value"
  | "falsifiability"
  | "evidence"
  | "robustness"
  | "reproducibility"
  | "causal"
  | "ethics";

export type RubricDimensionScore = {
  id: RubricDimensionId;
  label: string;
  score: number; // 0..5
  tests: AutoTest[];
  rationale: string;
};

export type ReproductionSummary = {
  status: "not_started" | "in_progress" | "partial" | "verified";
  open: number;
  claimed: number;
  passed: number;
  total: number;
};

export type MethodCard = {
  title: string;
  fields: Array<{ label: string; value: string; status?: EpistemicVerdict }>;
};

export type ConclusionVersionV1 = {
  id: string;
  version: 1;
  versionLabel: string;
  createdAt: string;
  paperId: string;
  paperSnapshot: Paper;
  summary: {
    verdict: EpistemicVerdict;
    overallScore: number; // 0..5
    oneLine: string;
  };
  rubric: RubricDimensionScore[];
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  alignment: EpistemicReview["alignment"];
  risk: RiskReport;
  reproduction: ReproductionSummary;
  modelCard: MethodCard;
  dataCard: MethodCard;
  sources: {
    epistemicReviewId?: string;
    defenseEvaluationId?: string;
    workOrdersUpdatedAt?: string;
  };
};

export type ConclusionStoreV1 = {
  version: 1;
  paperId: string;
  activeId: string | null;
  versions: ConclusionVersionV1[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function scoreFromStatus(status: EpistemicVerdict) {
  if (status === "pass") return 1;
  if (status === "needs_evidence") return 0.6;
  if (status === "na") return 0.85;
  return 0;
}

function weightedScoreToFive(tests: AutoTest[]) {
  const applicable = tests.filter((t) => t.status !== "na");
  if (!applicable.length) return 0;
  const totalWeight = applicable.reduce((acc, t) => acc + (t.weight ?? 1), 0);
  const score01 = applicable.reduce((acc, t) => acc + scoreFromStatus(t.status) * (t.weight ?? 1), 0) / totalWeight;
  return roundToHalf(clamp01(score01) * 5);
}

function hasThresholdNumbers(text: string) {
  return /\b\d+(\.\d+)?\b/.test(text);
}

function detectAblationsLanguage(text: string) {
  return /\b(ablation|baseline|control|sensitivity|robust|stress test)\b/i.test(text);
}

function detectOodLanguage(text: string) {
  return /\b(ood|out-of-distribution|generalization|domain shift)\b/i.test(text);
}

function detectCausalLanguage(text: string) {
  return /\b(cause|causal|leads to|results in|drives|induces)\b/i.test(text);
}

function isPassish(v: EpistemicVerdict) {
  return v === "pass" || v === "na";
}

function computeReproductionSummary(store?: WorkOrdersStoreV1 | null): ReproductionSummary {
  const orders = store?.orders || [];
  const total = orders.length;
  const open = orders.filter((o) => o.status === "open").length;
  const claimed = orders.filter((o) => o.status === "claimed" || o.status === "pass_pending_audit").length;
  const passed = orders.filter((o) => o.status === "passed").length;

  const status: ReproductionSummary["status"] =
    total === 0 || (open === total && claimed === 0 && passed === 0)
      ? "not_started"
      : passed > 0 && open === 0 && claimed === 0
        ? "verified"
        : passed > 0
          ? "partial"
          : "in_progress";

  return { status, open, claimed, passed, total };
}

function computeEvidenceCoverage(args: {
  claimEvidence: ClaimEvidence[];
  alignment: EpistemicReview["alignment"];
}) {
  const claims = args.claimEvidence.filter((c) => c.claim.trim().length > 0);
  if (claims.length) {
    const covered = claims.filter((c) => (c.evidenceIds || []).length > 0).length;
    return { total: claims.length, covered, ratio: covered / claims.length };
  }
  const aligned = args.alignment.filter((a) => a.claim.trim().length > 0);
  if (!aligned.length) return { total: 0, covered: 0, ratio: 0 };
  const covered = aligned.filter((a) => (a.evidence || []).length > 0).length;
  return { total: aligned.length, covered, ratio: covered / aligned.length };
}

function makeModelCard(args: {
  paper: Paper;
  selfReport: IntegritySelfReport;
  epistemicReview?: EpistemicReview | null;
  defenseEvaluation?: DefenseEvaluation | null;
  reproduction: ReproductionSummary;
  risk: RiskReport;
}): MethodCard {
  const { paper, selfReport, epistemicReview, defenseEvaluation, reproduction, risk } = args;

  const verdict = epistemicReview?.summary.verdict || "needs_evidence";
  const overallDefense = defenseEvaluation?.summary?.verdict || "needs_evidence";

  const topRisks = risk.flags
    .filter((f) => f.severity === "high")
    .slice(0, 2)
    .map((f) => f.title)
    .join("; ");

  return {
    title: "Model Card",
    fields: [
      { label: "Objective", value: paper.title || "Untitled", status: verdict },
      { label: "Intended Use", value: paper.articleType, status: "na" },
      { label: "Method Type", value: selfReport.usesMl ? "ML / predictive modeling" : "Theoretical / non-ML", status: "na" },
      {
        label: "Audit Verdict",
        value: epistemicReview ? `${epistemicReview.summary.verdict.toUpperCase()} (${Math.round(epistemicReview.summary.confidence * 100)}% conf)` : "NEEDS_EVIDENCE (no rubric run yet)",
        status: verdict,
      },
      {
        label: "Defense Status",
        value: defenseEvaluation ? `${overallDefense.toUpperCase()} (${Math.round(defenseEvaluation.overallScore * 100)}/100)` : "Not evaluated",
        status: overallDefense,
      },
      {
        label: "Reproduction",
        value:
          reproduction.status === "verified"
            ? `Verified (${reproduction.passed}/${reproduction.total})`
            : reproduction.status === "partial"
              ? `Partial (${reproduction.passed}/${reproduction.total})`
              : reproduction.status === "in_progress"
                ? `In progress (${reproduction.claimed} claimed)`
                : "Not started",
        status: reproduction.status === "verified" ? "pass" : reproduction.status === "partial" ? "needs_evidence" : "needs_evidence",
      },
      {
        label: "Top Risks",
        value: topRisks || "None detected from current metadata",
        status: topRisks ? "needs_evidence" : "pass",
      },
      {
        label: "Key Limitations",
        value: (epistemicReview?.limitations || []).slice(0, 2).join(" ") || "Not provided",
        status: epistemicReview?.limitations?.length ? "needs_evidence" : "na",
      },
    ],
  };
}

function makeDataCard(args: {
  paper: Paper;
  selfReport: IntegritySelfReport;
  evidencePointers: EvidencePointer[];
}): MethodCard {
  const { paper, selfReport, evidencePointers } = args;
  const dataPointers = evidencePointers.filter((p) => p.type === "data");
  const hasData = Boolean(paper.dataAvailable || paper.dataUrl || dataPointers.length);
  const hasPinnedData = dataPointers.some((p) => Boolean((p.hash || "").trim() || (p.doi || "").trim()));

  return {
    title: "Data Card",
    fields: [
      {
        label: "Data Availability",
        value: hasData ? "Yes" : "No / Not specified",
        status: hasData ? "pass" : "needs_evidence",
      },
      {
        label: "Data Source",
        value: paper.dataUrl || dataPointers.map((p) => p.url).filter(Boolean).slice(0, 1).join("") || "Unknown",
        status: hasData ? "needs_evidence" : "na",
      },
      {
        label: "Pinned Identifier",
        value: hasPinnedData ? "Hash/DOI provided" : "Missing hash/DOI pinning",
        status: hasPinnedData ? "pass" : hasData ? "needs_evidence" : "na",
      },
      {
        label: "Train/Test Split",
        value: selfReport.trainTestSplit.toUpperCase(),
        status: selfReport.trainTestSplit === "yes" ? "pass" : selfReport.usesMl ? "needs_evidence" : "na",
      },
      {
        label: "Sample Size",
        value: selfReport.sampleSize.trim() || "Unknown",
        status: selfReport.sampleSize.trim() ? "pass" : "needs_evidence",
      },
      { label: "License", value: "Unknown (not provided in demo)", status: "needs_evidence" },
    ],
  };
}

export function computeConclusionVersion(args: {
  id: string;
  versionLabel: string;
  createdAt: string;
  paper: Paper;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  risk: RiskReport;
  epistemicReview?: EpistemicReview | null;
  defenseEvaluation?: DefenseEvaluation | null;
  selfReport: IntegritySelfReport;
  workOrdersStore?: WorkOrdersStoreV1 | null;
}): ConclusionVersionV1 {
  const { paper, evidencePointers, claimEvidence, risk, epistemicReview, defenseEvaluation, selfReport } = args;

  const reproduction = computeReproductionSummary(args.workOrdersStore);
  const alignment = epistemicReview?.alignment || [];
  const coverage = computeEvidenceCoverage({ claimEvidence, alignment });

  const falsifiabilityText = (paper.falsifiabilityPath || "").trim();
  const abstract = (paper.abstract || "").trim();
  const causal = detectCausalLanguage(abstract);

  const evidencePointersCount = evidencePointers.filter((p) => p.label.trim().length > 0).length;
  const codePointers = evidencePointers.filter((p) => p.type === "code");
  const hasPinnedCode = codePointers.some((p) => Boolean((p.commit || "").trim() || (p.hash || "").trim()));

  const counterTestsCount = alignment.reduce((acc, row) => acc + (row.counterTests?.length || 0), 0);
  const gapsCount = alignment.reduce((acc, row) => acc + (row.gaps?.length || 0), 0);

  const evidenceCounts = (() => {
    const provided = claimEvidence.filter((c) => c.claim.trim().length > 0);
    if (provided.length) return provided.map((c) => (c.evidenceIds || []).length);
    const aligned = alignment.filter((a) => a.claim.trim().length > 0);
    return aligned.map((a) => (a.evidence || []).length);
  })();
  const avgEvidencePerClaim = evidenceCounts.length ? evidenceCounts.reduce((acc, n) => acc + n, 0) / evidenceCounts.length : 0;

  const evidenceText = evidencePointers
    .map((p) => [p.type, p.label, p.ref, p.url, p.doi, p.commit, p.hash, p.note].filter(Boolean).join(" "))
    .join("\n");
  const hasEnvSpec = /\b(docker|conda|environment\.yml|requirements\.txt|poetry|pip|uv|nix)\b/i.test(evidenceText);
  const hasLeakageAudit = /\b(leakage|dedup|de-dup|overlap|split audit)\b/i.test(`${abstract}\n${evidenceText}`);
  const hasPowerAnalysis = selfReport.powerAnalysis === "yes";
  const hasNegControl = /\b(negative control|placebo|null test|counterexample)\b/i.test(`${falsifiabilityText}\n${abstract}`);

  const dimensionScores: RubricDimensionScore[] = [
    {
      id: "value",
      label: "Problem Value",
      tests: [
        {
          id: "value.problem_clear",
          label: "Problem statement is legible from record",
          status: paper.title.trim().length > 8 && abstract.length > 120 ? "pass" : "needs_evidence",
          detail: "Checks title/abstract completeness (record-level only).",
          fix: "Add a 3–5 sentence abstract: problem → method → results → limitations.",
        },
        {
          id: "value.delta",
          label: "Delta vs. prior work is specified",
          status: /\b(compared to|baseline|prior work|related work)\b/i.test(abstract) ? "pass" : "needs_evidence",
          detail: "Looks for positioning language in abstract.",
          fix: "List the 3 closest works and state the measurable delta for each core claim.",
        },
        {
          id: "value.impact",
          label: "Downstream impact/use-case is stated",
          status: /\b(application|implication|impact|enables|use-case)\b/i.test(abstract) ? "pass" : "needs_evidence",
          detail: "Heuristic scan for impact framing.",
          fix: "Add a concrete decision/prediction that changes if the claim holds.",
        },
      ],
      score: 0,
      rationale: "Scores are heuristic; full novelty assessment requires full-text + prior-art search.",
    },
    {
      id: "falsifiability",
      label: "Falsifiability",
      tests: [
        {
          id: "falsif.path_present",
          label: "Falsifiability path exists",
          status: falsifiabilityText && falsifiabilityText.toLowerCase() !== "n/a" ? "pass" : "needs_evidence",
          detail: "Requires an explicit falsification procedure.",
          fix: "Add a falsifiable prediction with a threshold + negative control.",
          weight: 1.2,
        },
        {
          id: "falsif.threshold",
          label: "Threshold / measurable criterion is stated",
          status: falsifiabilityText && hasThresholdNumbers(falsifiabilityText) ? "pass" : falsifiabilityText ? "needs_evidence" : "needs_evidence",
          detail: "Looks for numeric thresholds in the falsification statement.",
          fix: "Specify a quantitative threshold and failure mode (counterexample).",
          weight: 1.2,
        },
        {
          id: "falsif.neg_control",
          label: "Negative control / counterexample test is declared",
          status: hasNegControl ? "pass" : falsifiabilityText ? "needs_evidence" : "needs_evidence",
          detail: "Heuristic scan for negative controls or explicit counterexamples.",
          fix: "Add a negative control and a counterexample scenario that would falsify the claim.",
        },
        {
          id: "falsif.prereg",
          label: "Pre-registration / analysis plan",
          status: selfReport.preregistered === "yes" ? "pass" : selfReport.preregistered === "no" ? "needs_evidence" : "needs_evidence",
          detail: "Uses author self-report.",
          fix: "Pre-register hypotheses and primary outcomes (or provide an analysis plan).",
        },
        {
          id: "falsif.countertests",
          label: "Counter-tests attached per claim",
          status: counterTestsCount > 0 ? "pass" : "needs_evidence",
          detail: "Counts counter-tests in the claim–evidence alignment matrix.",
          fix: "Add at least 1 counter-test per core claim.",
        },
      ],
      score: 0,
      rationale: "Falsifiability is treated as an engineering spec: observable → threshold → negative control.",
    },
    {
      id: "evidence",
      label: "Evidence Linkage",
      tests: [
        {
          id: "evidence.coverage",
          label: "Claims link to evidence pointers",
          status: coverage.total > 0 && coverage.ratio >= 0.8 ? "pass" : coverage.total > 0 ? "needs_evidence" : "needs_evidence",
          detail: `Coverage: ${coverage.covered}/${coverage.total} claims linked.`,
          fix: "Link each claim to at least one figure/table/data/code pointer.",
          weight: 1.4,
        },
        {
          id: "evidence.density",
          label: "Evidence density per claim (>= 2 pointers per claim)",
          status: avgEvidencePerClaim >= 2 ? "pass" : avgEvidencePerClaim >= 1 ? "needs_evidence" : "needs_evidence",
          detail: `Average evidence pointers per claim: ${avgEvidencePerClaim.toFixed(1)}.`,
          fix: "Attach multiple independent evidence pointers per core claim (e.g., Figure + Table + Stat test).",
        },
        {
          id: "evidence.pointer_count",
          label: "Evidence pointer index is populated",
          status: evidencePointersCount >= 5 ? "pass" : evidencePointersCount >= 2 ? "needs_evidence" : "needs_evidence",
          detail: "Counts labeled evidence pointers (figure/table/data/code/etc).",
          fix: "Add pointers for core figures/tables + a pinned code snapshot + data hash/DOI.",
        },
        {
          id: "evidence.gaps",
          label: "Gaps are explicitly enumerated",
          status: gapsCount > 0 ? "pass" : "needs_evidence",
          detail: "The alignment matrix should list gaps for auditability.",
          fix: "Add missing evidence items as explicit gaps per claim.",
        },
      ],
      score: 0,
      rationale: "Evidence linkage is scored by auditable claim→pointer coverage, not narrative persuasion.",
    },
    {
      id: "robustness",
      label: "Method Robustness",
      tests: [
        {
          id: "robust.leakage",
          label: "Leakage checks / split protocol",
          status: selfReport.usesMl ? (selfReport.trainTestSplit === "yes" ? "pass" : "needs_evidence") : "na",
          detail: "Requires a train/test separation for predictive claims.",
          fix: "Define split protocol; fit preprocessing on train-only; rerun.",
          weight: 1.3,
        },
        {
          id: "robust.blind_leakage",
          label: "Blind leakage audit (synthetic overlap / dedup across splits)",
          status: !selfReport.usesMl ? "na" : selfReport.trainTestSplit === "yes" && hasLeakageAudit ? "pass" : "needs_evidence",
          detail: "Auto-test stub: checks whether a leakage/dedup audit is declared for ML pipelines.",
          fix: "Run a dedup/overlap audit across splits; publish the script + summary (hash overlap, identifiers).",
          weight: 1.2,
        },
        {
          id: "robust.power",
          label: "Statistical power calculation / uncertainty accounting",
          status: selfReport.powerAnalysis === "na" ? "na" : hasPowerAnalysis ? "pass" : "needs_evidence",
          detail: "Auto-test stub: requires a power analysis or explicit uncertainty bounds for empirical claims.",
          fix: "Provide power analysis (or widen uncertainty bounds) and report all tested variants.",
        },
        {
          id: "robust.synthetic_counterexample",
          label: "Synthetic counterexample / adversarial robustness test",
          status: /\b(counterexample|adversarial|synthetic)\b/i.test(`${abstract}\n${evidenceText}`) ? "pass" : "needs_evidence",
          detail: "Auto-test stub: probes whether the claim survives constructed counterexamples.",
          fix: "Generate synthetic counterexamples and stress-test the method; report failure modes and thresholds.",
        },
        {
          id: "robust.multihyp",
          label: "Multiple hypotheses risk managed",
          status:
            selfReport.multipleHypotheses === "no"
              ? "pass"
              : selfReport.preregistered === "yes"
                ? "pass"
                : selfReport.multipleHypotheses === "yes"
                  ? "needs_evidence"
                  : "needs_evidence",
          detail: "Self-report + preregistration proxy.",
          fix: "Pre-register or correct for multiple comparisons (FDR/Bonferroni).",
        },
        {
          id: "robust.controls",
          label: "Ablations / controls are indicated",
          status: detectAblationsLanguage(abstract) ? "pass" : "needs_evidence",
          detail: "Heuristic scan for controls/ablation language in the abstract.",
          fix: "Add negative controls, ablations, and sensitivity analyses with thresholds.",
        },
      ],
      score: 0,
      rationale: "Robustness prioritizes known failure modes: leakage, multiple comparisons, and missing controls.",
    },
    {
      id: "reproducibility",
      label: "Reproducibility",
      tests: [
        {
          id: "repro.open_code",
          label: "Open code artifact exists",
          status: paper.codeAvailable ? "pass" : "needs_evidence",
          detail: "Based on record metadata + evidence pointers.",
          fix: "Provide a public repo or archived snapshot.",
        },
        {
          id: "repro.pinned_code",
          label: "Code is pinned (commit/hash)",
          status: hasPinnedCode || Boolean((paper.codeHash || "").trim()) ? "pass" : paper.codeAvailable ? "needs_evidence" : "na",
          detail: "Pinning enables deterministic reproduction.",
          fix: "Pin a commit hash/SWHID and include environment spec.",
          weight: 1.2,
        },
        {
          id: "repro.env_spec",
          label: "Environment is specified (Docker/conda/requirements)",
          status: hasEnvSpec ? "pass" : paper.codeAvailable ? "needs_evidence" : "needs_evidence",
          detail: "Auto-test stub: checks whether an environment spec is referenced in evidence pointers.",
          fix: "Provide Dockerfile/conda env/requirements and pin dependency versions.",
        },
        {
          id: "repro.open_data",
          label: "Data artifacts are accessible (or N/A)",
          status: paper.dataAvailable ? "pass" : "needs_evidence",
          detail: "For theoretical work, provide runnable notebooks and parameter sweeps.",
          fix: "Provide data URL/DOI or declare N/A explicitly with artifacts.",
        },
        {
          id: "repro.seeded",
          label: "Deterministic seed exists for verification",
          status: reproduction.total > 0 ? "pass" : "needs_evidence",
          detail: "Work orders create deterministic seeds + subsamples.",
          fix: "Generate verification work orders or attach deterministic seeds to experiments.",
        },
        {
          id: "repro.status",
          label: "Reproduction tickets status",
          status: reproduction.status === "verified" ? "pass" : reproduction.status === "partial" ? "needs_evidence" : "needs_evidence",
          detail: `Passed ${reproduction.passed}/${reproduction.total}.`,
          fix: "Have independent validators run the notebook and submit artifacts.",
          weight: 1.1,
        },
      ],
      score: 0,
      rationale: "Reproducibility is scored by pinned artifacts + independent verification tickets.",
    },
    {
      id: "causal",
      label: "Causal & OOD",
      tests: [
        {
          id: "causal.language",
          label: "Causal claims are flagged",
          status: causal ? "needs_evidence" : "na",
          detail: "If causal language exists, identification must be specified.",
          fix: "State identification assumptions and alternative explanations.",
        },
        {
          id: "causal.identification",
          label: "Identification strategy is stated (if causal)",
          status: !causal ? "na" : /\b(randomi[sz]ed|instrument|confound|causal graph|do\(|difference-in-differences)\b/i.test(abstract) ? "pass" : "needs_evidence",
          detail: "Heuristic scan for identification language.",
          fix: "Add design/assumptions; run confounder robustness checks.",
          weight: 1.2,
        },
        {
          id: "ood.generalization",
          label: "Cross-distribution retest / OOD evaluation exists",
          status: detectOodLanguage(abstract) ? "pass" : "needs_evidence",
          detail: "OOD claims require cross-distribution evaluation.",
          fix: "Evaluate on an external dataset or shifted parameter regime and report failure modes.",
        },
      ],
      score: 0,
      rationale: "Causal/OOD scores emphasize explicit assumptions and cross-distribution tests.",
    },
    {
      id: "ethics",
      label: "Ethics & Dual-use",
      tests: [
        {
          id: "ethics.statement",
          label: "Risk / misuse statement is present",
          status: /\b(risk|misuse|dual-use|safety|harm|ethic)\b/i.test(abstract) ? "pass" : "needs_evidence",
          detail: "Heuristic scan for safety language in abstract/context.",
          fix: "Add a short risk statement: who could be harmed and how to mitigate.",
        },
        {
          id: "ethics.mitigation",
          label: "Mitigation actions exist (if risk)",
          status: /\b(mitigat|safeguard|monitor|limit|policy)\b/i.test(abstract) ? "pass" : "needs_evidence",
          detail: "Mitigation is usually absent at record-level; treat as a prompt.",
          fix: "Provide mitigation plan and scope limits.",
        },
      ],
      score: 0,
      rationale: "Ethics scoring is conservative: missing info defaults to needs-evidence.",
    },
  ];

  for (const d of dimensionScores) d.score = weightedScoreToFive(d.tests);

  const overallScore = roundToHalf(dimensionScores.reduce((acc, d) => acc + d.score, 0) / dimensionScores.length);
  const highFlags = risk.flags.filter((f) => f.severity === "high").length;

  const verdict: EpistemicVerdict =
    overallScore >= 4 && highFlags === 0 && reproduction.status === "verified"
      ? "pass"
      : overallScore < 2
        ? "fail"
        : "needs_evidence";

  const oneLine =
    verdict === "pass"
      ? "Evidence alignment is strong and independent verification is complete."
      : verdict === "fail"
        ? "Conclusion is not supported at current evidence/verification levels."
        : "Conclusion is provisional: add evidence linkage and complete verification tickets.";

  const modelCard = makeModelCard({
    paper,
    selfReport,
    epistemicReview,
    defenseEvaluation,
    reproduction,
    risk,
  });

  const dataCard = makeDataCard({ paper, selfReport, evidencePointers });

  return {
    id: args.id,
    version: 1,
    versionLabel: args.versionLabel,
    createdAt: args.createdAt,
    paperId: paper.id,
    paperSnapshot: paper,
    summary: {
      verdict,
      overallScore,
      oneLine,
    },
    rubric: dimensionScores,
    evidencePointers,
    claimEvidence,
    alignment,
    risk,
    reproduction,
    modelCard,
    dataCard,
    sources: {
      epistemicReviewId: epistemicReview?.id,
      defenseEvaluationId: defenseEvaluation?.id,
      workOrdersUpdatedAt: args.workOrdersStore?.updatedAt,
    },
  };
}

export function nextConclusionLabel(existing: ConclusionVersionV1[]) {
  const next = existing.length + 1;
  return `v${next}`;
}

export function computeActiveEpistemicReview(store: { activeId: string | null; runs: EpistemicReview[] } | null) {
  if (!store || !store.runs.length) return null;
  if (store.activeId) return store.runs.find((r) => r.id === store.activeId) || store.runs[store.runs.length - 1];
  return store.runs[store.runs.length - 1];
}

export function deriveOverallVerdictFromRubric(rubric: RubricDimensionScore[]): EpistemicVerdict {
  const avg = rubric.length ? rubric.reduce((acc, d) => acc + d.score, 0) / rubric.length : 0;
  const hardFail = rubric.some((d) => d.score <= 1);
  if (hardFail || avg < 2) return "fail";
  if (avg >= 4.25 && rubric.every((d) => isPassish(d.tests[0]?.status || "needs_evidence"))) return "pass";
  return "needs_evidence";
}
