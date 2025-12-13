import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer, EvidencePointerType } from "@/lib/review/evidence";

export type IntegritySelfReport = {
  usesMl: boolean;
  trainTestSplit: "yes" | "no" | "na";
  preregistered: "yes" | "no" | "unknown";
  multipleHypotheses: "yes" | "no" | "unknown";
  powerAnalysis: "yes" | "no" | "na";
  sampleSize: string;
};

export type RiskSeverity = "low" | "medium" | "high";

export type RiskFlag = {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  fix: string;
};

export type RadarAxisId =
  | "value"
  | "falsifiability"
  | "evidence"
  | "robustness"
  | "leakage"
  | "reproducibility"
  | "causality"
  | "related"
  | "ethics";

export type RadarAxis = {
  id: RadarAxisId;
  label: string;
  value: number; // 0..1
};

export type RiskReport = {
  axes: RadarAxis[];
  flags: RiskFlag[];
  summary: {
    score: number; // 0..1
    evidenceCoverage: number; // 0..1
    traceability: number; // 0..1
  };
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hasCausalLanguage(text: string) {
  return /\b(cause|causal|leads to|results in|drives|induces)\b/i.test(text);
}

function claimsCoverage(claimEvidence: ClaimEvidence[]) {
  const claims = claimEvidence.filter((c) => c.claim.trim().length > 0);
  if (!claims.length) return { total: 0, covered: 0, coverage: 0 };
  const covered = claims.filter((c) => (c.evidenceIds || []).length > 0).length;
  return { total: claims.length, covered, coverage: covered / claims.length };
}

function pointerTraceabilityScore(p: EvidencePointer) {
  const hasLocator = Boolean((p.ref || "").trim() || (p.url || "").trim() || (p.doi || "").trim());
  const hasHash = Boolean((p.hash || "").trim());
  const hasCommit = Boolean((p.commit || "").trim());

  if (p.type === "code") {
    if (!hasLocator) return 0.25;
    if (hasCommit || hasHash) return 1;
    return 0.6;
  }
  if (p.type === "data") {
    if (!hasLocator) return 0.25;
    if (hasHash || (p.doi || "").trim()) return 1;
    return 0.7;
  }

  return hasLocator ? 0.9 : 0.5;
}

function overallTraceability(evidencePointers: EvidencePointer[]) {
  if (!evidencePointers.length) return 0;
  const scores = evidencePointers.map(pointerTraceabilityScore);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function countPointersOfType(evidencePointers: EvidencePointer[], type: EvidencePointerType) {
  return evidencePointers.filter((p) => p.type === type).length;
}

export function computeRiskReport(args: {
  paper: Paper;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  selfReport: IntegritySelfReport;
}): RiskReport {
  const { paper, evidencePointers, claimEvidence, selfReport } = args;

  const flags: RiskFlag[] = [];
  const coverage = claimsCoverage(claimEvidence);
  const traceability = overallTraceability(evidencePointers);

  if (coverage.total > 0 && coverage.covered < coverage.total) {
    flags.push({
      id: "claims.unlinked",
      severity: "high",
      title: "Claims without linked evidence",
      detail: `${coverage.covered}/${coverage.total} claims have at least one evidence pointer.`,
      fix: "Link each claim to at least one figure/table/data/code pointer and add a counter-test.",
    });
  }

  if (coverage.total > 0 && evidencePointers.length === 0) {
    flags.push({
      id: "evidence.none",
      severity: "high",
      title: "No evidence pointers provided",
      detail: "The platform cannot audit claims without traceable pointers.",
      fix: "Add pointers for core figures/tables, data artifacts, and a pinned code snapshot (commit/hash/DOI).",
    });
  }

  const hasCode = paper.codeAvailable || Boolean(paper.codeUrl);
  const hasData = paper.dataAvailable || Boolean(paper.dataUrl);
  const codePointers = countPointersOfType(evidencePointers, "code");
  const dataPointers = countPointersOfType(evidencePointers, "data");

  if (hasCode && codePointers === 0) {
    flags.push({
      id: "trace.code.pointer_missing",
      severity: "medium",
      title: "Code is present but not traceable",
      detail: "No evidence pointer of type=code is provided (commit/hash not anchored).",
      fix: "Add a code evidence pointer with URL + commit hash (or archived DOI/SWHID).",
    });
  }

  if (hasData && dataPointers === 0) {
    flags.push({
      id: "trace.data.pointer_missing",
      severity: "medium",
      title: "Data is present but not traceable",
      detail: "No evidence pointer of type=data is provided (hash/DOI not anchored).",
      fix: "Add a data evidence pointer with URL/DOI + content hash.",
    });
  }

  if (selfReport.usesMl && selfReport.trainTestSplit === "no") {
    flags.push({
      id: "leakage.split_no",
      severity: "high",
      title: "Leakage risk: no train/test split",
      detail: "Self-report indicates no train/test separation for ML/predictive modeling.",
      fix: "Define splits, ensure preprocessing is fit on train-only, and re-run evaluation.",
    });
  }

  if (selfReport.usesMl && selfReport.trainTestSplit === "na") {
    flags.push({
      id: "leakage.split_na",
      severity: "medium",
      title: "Leakage risk: split not specified",
      detail: "Uses ML but train/test split is marked N/A.",
      fix: "Clarify whether a predictive evaluation exists; if so, provide split protocol + leakage audit.",
    });
  }

  if (selfReport.multipleHypotheses === "yes" && selfReport.preregistered !== "yes") {
    flags.push({
      id: "phacking.multiple",
      severity: "medium",
      title: "p-hacking / multiple comparisons risk",
      detail: "Multiple hypotheses reported without pre-registration.",
      fix: "Pre-register analysis or apply correction (FDR/Bonferroni) and report all tested variants.",
    });
  }

  const n = Number(selfReport.sampleSize);
  if (Number.isFinite(n) && n > 0 && selfReport.powerAnalysis === "no" && n < 30) {
    flags.push({
      id: "power.low_n",
      severity: "medium",
      title: "Low power risk (small sample without power analysis)",
      detail: `Reported sample size is ${n} with power analysis = no.`,
      fix: "Provide power analysis or widen uncertainty bounds; consider replication with larger N.",
    });
  }

  const falsifiabilityText = (paper.falsifiabilityPath || "").trim();
  if (!falsifiabilityText || falsifiabilityText.toLowerCase() === "n/a" || falsifiabilityText.length < 30) {
    flags.push({
      id: "falsifiability.missing",
      severity: "medium",
      title: "Falsifiability path is weak or missing",
      detail: "Falsifiability requires an observable threshold + a negative control.",
      fix: "Write a falsification test with concrete thresholds and a counterexample scenario.",
    });
  }

  const abstract = paper.abstract || "";
  if (hasCausalLanguage(abstract)) {
    flags.push({
      id: "causality.check",
      severity: "low",
      title: "Causal language detected",
      detail: "Abstract contains causal terms; identification strategy is not verifiable from metadata.",
      fix: "State the identification assumptions; add robustness checks and alternative explanations.",
    });
  }

  const axes: RadarAxis[] = [
    { id: "value", label: "Value", value: 0.45 },
    {
      id: "falsifiability",
      label: "Falsifiability",
      value: clamp01((falsifiabilityText && falsifiabilityText.toLowerCase() !== "n/a" ? 0.25 : 0.05) + Math.min(0.75, falsifiabilityText.length / 220)),
    },
    { id: "evidence", label: "Evidence", value: clamp01(0.15 + 0.6 * coverage.coverage + 0.25 * Math.min(1, evidencePointers.length / 6)) },
    {
      id: "robustness",
      label: "Robustness",
      value: clamp01(
        0.25 +
          (selfReport.preregistered === "yes" ? 0.25 : selfReport.preregistered === "no" ? 0.05 : 0.12) +
          (selfReport.powerAnalysis === "yes" ? 0.2 : selfReport.powerAnalysis === "no" ? 0.05 : 0.12)
      ),
    },
    {
      id: "leakage",
      label: "Leakage",
      value: clamp01(
        selfReport.trainTestSplit === "yes" ? 0.85 : selfReport.trainTestSplit === "no" ? 0.2 : selfReport.usesMl ? 0.35 : 0.6
      ),
    },
    {
      id: "reproducibility",
      label: "Repro",
      value: clamp01(
        0.15 +
          (hasCode ? 0.25 : 0) +
          (hasData ? 0.2 : 0) +
          0.4 * traceability
      ),
    },
    { id: "causality", label: "Causality", value: hasCausalLanguage(abstract) ? 0.35 : 0.55 },
    { id: "related", label: "Related", value: 0.4 },
    { id: "ethics", label: "Ethics", value: 0.45 },
  ];

  const score = axes.reduce((acc, a) => acc + a.value, 0) / axes.length;

  return {
    axes,
    flags: flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : a.severity === "medium" && b.severity === "low" ? -1 : 1)),
    summary: {
      score: Number(score.toFixed(2)),
      evidenceCoverage: Number(coverage.coverage.toFixed(2)),
      traceability: Number(traceability.toFixed(2)),
    },
  };
}

