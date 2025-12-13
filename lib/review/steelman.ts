import type { Paper } from "@/lib/mockData";
import type { EpistemicVerdict } from "@/lib/review/epistemic";
import { formatEvidencePointer, type EvidencePointer } from "@/lib/review/evidence";

export type SteelmanCategory =
  | "value"
  | "falsifiability"
  | "evidence"
  | "robustness"
  | "leakage"
  | "reproducibility"
  | "causality"
  | "related"
  | "ethics";

export type SteelmanSeverity = "low" | "medium" | "high";

export type SteelmanAttack = {
  id: string;
  category: SteelmanCategory;
  severity: SteelmanSeverity;
  title: string;
  target: string;
  attack: string;
  evidence: string[];
  counterTests: string[];
};

export type SteelmanAttackSet = {
  id: string;
  rubricVersion: "steelman-attack-v1";
  engine: "simulated" | "gemini";
  model: string;
  paperId: string;
  createdAt: string;
  context?: string;
  attacks: SteelmanAttack[];
};

export type DefenseResponse = {
  attackId: string;
  response: string;
};

export type DefenseEvaluationItem = {
  attackId: string;
  verdict: EpistemicVerdict;
  score: number; // 0..1
  rationale: string;
  evidenceUsed: string[];
  proposedTests: string[];
  missing: string[];
};

export type DefenseEvaluation = {
  id: string;
  rubricVersion: "steelman-defense-v1";
  engine: "simulated" | "gemini";
  model: string;
  paperId: string;
  createdAt: string;
  overallScore: number; // 0..1
  summary: {
    verdict: EpistemicVerdict;
    oneLine: string;
  };
  items: DefenseEvaluationItem[];
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

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function detectSignals(paper: Paper) {
  const abstract = (paper.abstract || "").trim();
  const isVeryShort = abstract.length > 0 && abstract.length < 240;
  const hasMethodsLanguage = /we\s+(propose|present|introduce|derive|show|demonstrate|evaluate|simulate|test)/i.test(abstract);
  const hasFalsifiability = (paper.falsifiabilityPath || "").trim().toLowerCase() !== "n/a" && (paper.falsifiabilityPath || "").trim().length > 24;
  const hasArtifacts = Boolean(paper.codeAvailable || paper.dataAvailable);
  const hasCausalLanguage = /\b(cause|causal|leads to|results in|drives|induces)\b/i.test(abstract);
  return { abstract, isVeryShort, hasMethodsLanguage, hasFalsifiability, hasArtifacts, hasCausalLanguage };
}

function baseEvidence(paper: Paper, userContext?: string, evidencePointers?: EvidencePointer[]) {
  const evidence = new Set<string>();
  if (paper.doi) evidence.add(`DOI: ${paper.doi}`);
  if (paper.codeAvailable && paper.codeUrl) evidence.add(`Code: ${paper.codeUrl}`);
  if (paper.dataAvailable) evidence.add("Data: available (per record metadata/files).");
  if (paper.falsifiabilityPath && paper.falsifiabilityPath.trim() && paper.falsifiabilityPath.trim().toLowerCase() !== "n/a") {
    evidence.add(`Falsifiability path: ${paper.falsifiabilityPath}`);
  }
  if (userContext?.trim()) evidence.add("Author context: provided for this run.");
  for (const p of evidencePointers || []) evidence.add(formatEvidencePointer(p));
  return Array.from(evidence);
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

export function generateMockSteelmanAttackSet(
  paper: Paper,
  opts?: { userContext?: string; evidencePointers?: EvidencePointer[] }
): SteelmanAttackSet {
  const userContext = (opts?.userContext || "").trim();
  const seedSource = `${paper.id}|${paper.doi}|${paper.title}|${paper.authors.map((a) => a.name).join(",")}`;
  const rng = mulberry32(hashStringToUint32(seedSource));

  const signals = detectSignals(paper);
  const evidence = baseEvidence(paper, userContext, opts?.evidencePointers);

  const severityFrom = (condition: boolean, high: SteelmanSeverity, low: SteelmanSeverity) => (condition ? high : low);
  const title = paper.title || "this work";

  const attacks: SteelmanAttack[] = [];

  attacks.push({
    id: makeId("atk"),
    category: "value",
    severity: severityFrom(/universal|unification|theory of everything|fundamental/i.test(title), "high", "medium"),
    title: "Value vs. novelty: what changes if true?",
    target: "Problem framing / contribution",
    attack:
      "Even if the narrative is compelling, it is unclear what downstream decision, prediction, or capability changes if the main claim holds. Without a crisp delta versus closest prior work, the contribution risks being 'interesting' rather than valuable.",
    evidence,
    counterTests: [
      "Name the top 3 closest prior works and state a measurable delta for each (scope, falsifiability, accuracy, runtime, theorem strength).",
      "State a concrete stakeholder and the decision that would change if the claim is correct; if none, value is unproven.",
    ],
  });

  attacks.push({
    id: makeId("atk"),
    category: "falsifiability",
    severity: signals.hasFalsifiability ? "medium" : "high",
    title: "Not falsifiable at record level (missing thresholds)",
    target: "Main claim falsifiability",
    attack:
      signals.hasFalsifiability
        ? "A falsifiability path exists, but it is not yet a protocol: it needs explicit thresholds, expected variance, negative controls, and a decision rule that an independent replicator can execute without interpretation."
        : "The record does not state what observation would falsify the claim (with a threshold). Without a failure condition, the claim is not testable and cannot be audited by the community.",
    evidence,
    counterTests: [
      signals.hasFalsifiability
        ? `Execute the falsification exactly as specified; pre-register the threshold: ${paper.falsifiabilityPath}`
        : "Define a thresholded prediction (effect size / error bound) and a negative control that should fail under the same pipeline.",
      "Provide at least one plausible counterexample and show whether the claim survives it.",
    ],
  });

  attacks.push({
    id: makeId("atk"),
    category: "evidence",
    severity: "high",
    title: "Claim–evidence mismatch (needs auditable mapping)",
    target: "Evidence chain density",
    attack:
      "The strongest version of your claim requires a claim→evidence mapping (which figure/table/derivation supports which statement). Without that alignment, readers cannot tell whether the conclusion is supported or merely suggested.",
    evidence,
    counterTests: [
      "Construct a claim→figure/table mapping; if any major claim lacks a primary support, downgrade it to hypothesis.",
      "Remove one key evidence piece; if the conclusion collapses, the chain is brittle and should be qualified.",
    ],
  });

  attacks.push({
    id: makeId("atk"),
    category: "robustness",
    severity: severityFrom(!signals.hasMethodsLanguage || signals.isVeryShort, "high", "medium"),
    title: "Robustness: could this be a parameter/estimator artifact?",
    target: "Method stability",
    attack:
      "A strong concern is that the reported effect may be sensitive to parameterization, preprocessing, or the chosen estimator. Without sensitivity analysis/ablations, it is hard to separate a real mechanism from a fragile artifact.",
    evidence,
    counterTests: [
      "Perturb key parameters by ±10% (or vary hyperparameters across a reasonable grid) and report failure regions.",
      "Swap to an alternative estimator/metric and check whether the qualitative conclusion persists.",
      "Run an ablation that removes the claimed mechanism; the effect should disappear if causal.",
    ],
  });

  attacks.push({
    id: makeId("atk"),
    category: "reproducibility",
    severity: signals.hasArtifacts ? "medium" : "high",
    title: signals.hasArtifacts ? "Reproducibility: artifacts exist but protocol may not" : "Reproducibility: no artifacts detected",
    target: "Code/data executability",
    attack:
      signals.hasArtifacts
        ? "Even with artifacts, reproducibility requires a minimal executable protocol (inputs → outputs) and pinned versions. Without this, replication attempts will diverge due to hidden assumptions and environment drift."
        : "No code/data artifacts were detected in the record. That makes the claim effectively non-auditable and blocks independent verification.",
    evidence,
    counterTests: [
      "Reproduce from a clean environment using only pinned artifacts; any missing step indicates hidden dependencies.",
      signals.hasArtifacts ? "Add a one-command run script and expected outputs (hashes) for key results." : "Provide a public repo or archived snapshot with a pinned commit and environment spec.",
    ],
  });

  attacks.push({
    id: makeId("atk"),
    category: "related",
    severity: "medium",
    title: "Related work: missing fair baselines",
    target: "Positioning vs prior art",
    attack:
      "Without explicitly comparing to the strongest baselines / closest theories, it is easy to overstate novelty or explanatory power. The platform needs a defensible 'what is new' statement tied to measurable deltas.",
    evidence,
    counterTests: [
      "Pick the best baseline that disagrees with you and show where its predictions fail while yours succeed.",
      "If a stronger baseline eliminates the advantage, revise claims to a narrower, defensible scope.",
    ],
  });

  if (signals.hasCausalLanguage) {
    attacks.push({
      id: makeId("atk"),
      category: "causality",
      severity: "high",
      title: "Causal claims exceed identification strategy",
      target: "Causal validity",
      attack:
        "The text appears to make causal implications, but causal validity requires an identification strategy (interventions, confounder control, or a formal causal model). Without that, causal phrasing should be downgraded to correlation/compatibility.",
      evidence,
      counterTests: [
        "List the confounders that could explain the result; show how they are blocked/controlled.",
        "Provide an intervention or natural experiment that would change the cause while holding others fixed.",
      ],
    });
  } else {
    attacks.push({
      id: makeId("atk"),
      category: "leakage",
      severity: "low",
      title: "Leakage/contamination risk (if ML/data-driven)",
      target: "Dataset hygiene",
      attack:
        "If any part of the result depends on learned models or curated datasets, contamination/leakage can create illusory performance. The record does not document dataset lineage or de-duplication checks.",
      evidence,
      counterTests: [
        "Perform a de-duplication audit across splits (hash/identifier overlap).",
        "Re-run preprocessing fit on train-only; compare outcomes.",
      ],
    });
  }

  attacks.push({
    id: makeId("atk"),
    category: "ethics",
    severity: "low",
    title: "Ethics/dual-use: state risk and mitigation (if applicable)",
    target: "Social risk",
    attack:
      "Even purely theoretical work can be misused or misunderstood. A short risk statement improves auditability and responsible dissemination (who could be harmed and how to mitigate).",
    evidence,
    counterTests: ["If plausible misuse exists, require mitigation or limit promotion until addressed."],
  });

  const shuffled = attacks
    .map((a) => ({ a, k: rng() }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.a);

  return {
    id: makeId("atkset"),
    rubricVersion: "steelman-attack-v1",
    engine: "simulated",
    model: "simulated-steelman-v1",
    paperId: paper.id,
    createdAt: new Date().toISOString(),
    context: userContext || undefined,
    attacks: shuffled.slice(0, 7),
  };
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return Array.from(new Set(matches));
}

function sentenceHints(text: string, patterns: RegExp[]) {
  const sentences = text
    .split(/\n|[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hits = sentences.filter((s) => patterns.some((p) => p.test(s)));
  return hits.slice(0, 3);
}

export function evaluateDefenseResponses(args: {
  paper: Paper;
  attackSet: SteelmanAttackSet;
  responses: DefenseResponse[];
}): DefenseEvaluation {
  const responseById = new Map(args.responses.map((r) => [r.attackId, r.response]));

  const patternsEvidence = [/https?:\/\//i, /\bdoi\b/i, /\bfigure\b/i, /\btable\b/i, /\bappendix\b/i, /\bcode\b/i, /\bdata\b/i];
  const patternsTests = [
    /\bcontrol\b/i,
    /\bablation\b/i,
    /\bthreshold\b/i,
    /\bpre-?register\b/i,
    /\breplicat/i,
    /\bfalsif/i,
    /\bcounterexample\b/i,
    /\bsensitivity\b/i,
    /\bhyperparam/i,
    /\bconfound/i,
  ];
  const patternsConcession = [/\bwe (agree|acknowledge|concede)\b/i, /\blimitation\b/i, /\bwe do not claim\b/i, /\bmay\b/i, /\buncertain\b/i];

  const items: DefenseEvaluationItem[] = args.attackSet.attacks.map((attack) => {
    const response = (responseById.get(attack.id) || "").trim();
    const missing: string[] = [];
    const evidenceUsed = extractUrls(response);
    const hasEvidence = patternsEvidence.some((p) => p.test(response)) || evidenceUsed.length > 0;
    const proposedTests = sentenceHints(response, patternsTests);
    const hasTests = proposedTests.length > 0;
    const hasConcession = patternsConcession.some((p) => p.test(response));
    const hasQuant = /\b\d+(\.\d+)?\b/.test(response);

    let score = 0;
    if (!response) {
      missing.push("No response provided.");
      score = 0;
    } else {
      score += 0.45;
      if (hasEvidence) score += 0.2;
      else missing.push("No evidence links or citations.");
      if (hasTests) score += 0.2;
      else missing.push("No counter-test / replication protocol.");
      if (hasConcession) score += 0.1;
      else missing.push("No explicit concession/assumption boundary.");
      if (hasQuant) score += 0.05;
      score = clamp01(score - (response.length < 60 ? 0.12 : 0));
    }

    const verdict: EpistemicVerdict = !response ? "fail" : score >= 0.8 ? "pass" : "needs_evidence";
    const rationale =
      verdict === "fail"
        ? "Missing author response; cannot assess defense."
        : verdict === "pass"
          ? "Response cites evidence and proposes concrete counter-tests; boundaries are acknowledged."
          : "Response exists but still lacks evidence alignment and/or executable counter-tests.";

    return {
      attackId: attack.id,
      verdict,
      score: Number(score.toFixed(2)),
      rationale,
      evidenceUsed,
      proposedTests,
      missing,
    };
  });

  const overallScore = items.length ? items.reduce((acc, it) => acc + it.score, 0) / items.length : 0;
  const failCount = items.filter((it) => it.verdict === "fail").length;
  const summaryVerdict: EpistemicVerdict = failCount > 0 ? "fail" : overallScore >= 0.75 ? "pass" : "needs_evidence";

  return {
    id: makeId("defense"),
    rubricVersion: "steelman-defense-v1",
    engine: "simulated",
    model: "simulated-defense-eval-v1",
    paperId: args.paper.id,
    createdAt: new Date().toISOString(),
    overallScore: Number(overallScore.toFixed(2)),
    summary: {
      verdict: summaryVerdict,
      oneLine:
        summaryVerdict === "pass"
          ? "Defense addresses attacks with evidence and executable counter-tests."
          : summaryVerdict === "fail"
            ? "Defense incomplete: at least one steelman attack is unanswered."
            : "Defense partially addresses attacks; add evidence alignment and concrete counter-tests.",
    },
    items,
  };
}
