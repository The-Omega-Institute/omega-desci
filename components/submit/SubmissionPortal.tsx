"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ContributorRole, NonHumanContributor, Paper, StructuredAbstract } from "@/lib/mockData";
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

type ToolingChecklistItem =
  | "writing_editing"
  | "code_generation"
  | "data_generation"
  | "theorem_proof_search"
  | "citation_assistance"
  | "none";

type NonHumanContributorDraft = {
  name: string;
  versionOrId: string;
  scope: string;
  promptStrategy: string;
  validationSummary: string;
};

type Draft = {
  paperId: string;
  importedFrom: Paper["importedFrom"];
  title: string;
  doi: string;
  authorsText: string;
  responsibleStewardsText: string;
  contributorRoles: Record<ContributorRole, string>;
  nonHumanContributors: NonHumanContributorDraft[];
  toolingChecklist: ToolingChecklistItem[];
  toolingValidationNote: string;
  abstractStructured: StructuredAbstract;
  discipline: Paper["discipline"];
  articleType: Paper["articleType"];
  controlledKeywordsText: string;
  freeTagsText: string;
  license: string;
  competingInterests: string;
  funding: string;
  falsifiabilityPath: string;
  falsifiabilityCurrentlyUntestable: boolean;
  falsifiabilityDependencies: string;
  falsifiabilityTrigger: string;
  collectionVolume: string;
  aiContributionPercent: string;
  codeUrl: string;
  codeCommit: string;
  codeHash: string;
  dataUrl: string;
  dataHash: string;
};

type AssumptionLedgerEntry = {
  assumption: string;
  whyNeeded: string;
  falsify: string;
};

type PriorWorkEntry = {
  citation: string;
  inherits: string;
  conflicts: string;
  differs: string;
};

type SubmissionStoreV2 = {
  version: 2;
  draft: Draft;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  assumptionLedger: AssumptionLedgerEntry[];
  priorWork: PriorWorkEntry[];
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

const SUBMISSION_STORE_KEY = "omega_submission_portal_v2";
const LEGACY_SUBMISSION_STORE_KEY = "omega_submission_portal_v1";

const DISCIPLINES: Paper["discipline"][] = [
  "Digital Physics",
  "Cellular Automata",
  "Thermodynamics",
  "AI Foundations",
  "Cosmology",
];

const ARTICLE_TYPES: Paper["articleType"][] = [
  "Theory Preprint",
  "Conjecture Note",
  "Proof or Formal Derivation",
  "Computational Experiment",
  "Verification Report",
  "Replication Report",
  "Negative Result",
  "Survey or Synthesis",
  "Critique or Commentary",
];

const EVIDENCE_TYPES: EvidencePointerType[] = ["figure", "table", "data", "code", "stat_test", "appendix", "doi", "url"];

const TOOLING_OPTIONS: Array<{
  id: ToolingChecklistItem;
  labelEn: string;
  labelZh: string;
  requiresValidation: boolean;
}> = [
  {
    id: "writing_editing",
    labelEn: "Writing or editing assistance",
    labelZh: "写作或编辑辅助",
    requiresValidation: false,
  },
  {
    id: "code_generation",
    labelEn: "Code generation used in final pipeline",
    labelZh: "最终管线使用的代码生成",
    requiresValidation: true,
  },
  {
    id: "data_generation",
    labelEn: "Data generation or synthetic data used as evidence",
    labelZh: "作为证据的数据生成/合成数据",
    requiresValidation: true,
  },
  {
    id: "theorem_proof_search",
    labelEn: "Theorem or proof search assistance",
    labelZh: "定理/证明搜索辅助",
    requiresValidation: true,
  },
  {
    id: "citation_assistance",
    labelEn: "Automated citation or literature assistance",
    labelZh: "自动化引用/文献辅助",
    requiresValidation: false,
  },
  {
    id: "none",
    labelEn: "None",
    labelZh: "无",
    requiresValidation: false,
  },
];

const CONTRIBUTOR_ROLE_OPTIONS: Array<{ id: ContributorRole; labelEn: string; labelZh: string }> = [
  { id: "Conceptualization", labelEn: "Conceptualization", labelZh: "研究构想（Conceptualization）" },
  { id: "Methodology", labelEn: "Methodology", labelZh: "方法学（Methodology）" },
  { id: "Software", labelEn: "Software", labelZh: "软件（Software）" },
  { id: "Validation", labelEn: "Validation", labelZh: "验证/复核（Validation）" },
  { id: "Writing", labelEn: "Writing", labelZh: "写作（Writing）" },
  { id: "Visualization", labelEn: "Visualization", labelZh: "可视化（Visualization）" },
];

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

function parseUniqueCsv(text: string) {
  const raw = parseCsv(text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeToolingChecklist(value: unknown): ToolingChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<ToolingChecklistItem>(TOOLING_OPTIONS.map((o) => o.id));
  const out: ToolingChecklistItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const id = raw as ToolingChecklistItem;
    if (!allowed.has(id)) continue;
    out.push(id);
  }
  return out;
}

function requiresToolingValidation(items: ToolingChecklistItem[]) {
  const requireIds = new Set<ToolingChecklistItem>(TOOLING_OPTIONS.filter((o) => o.requiresValidation).map((o) => o.id));
  return items.some((id) => requireIds.has(id));
}

function formatToolingChecklist(items: ToolingChecklistItem[]) {
  if (items.includes("none")) return "None";
  const byId = new Map(TOOLING_OPTIONS.map((o) => [o.id, o.labelEn] as const));
  return items
    .map((id) => byId.get(id) || id)
    .filter(Boolean)
    .join("; ");
}

function formatProvenanceStatement(args: { toolingChecklist: ToolingChecklistItem[]; toolingValidationNote: string }) {
  const toolingChecklist = args.toolingChecklist;
  const validation = args.toolingValidationNote.trim();
  if (!toolingChecklist.length) return validation ? `Validation Note:\n${validation}` : "None";
  if (toolingChecklist.includes("none")) return "None";
  const header = `Tooling Checklist: ${formatToolingChecklist(toolingChecklist)}`;
  if (!validation) return header;
  return `${header}\n\nValidation Note:\n${validation}`;
}

function seemsCurrentlyUntestable(text: string) {
  const t = (text || "").toLowerCase();
  return /不可检验|暂不可检验|无法检验|不可验证|not\s+testable|untestable|cannot\s+be\s+tested|currently\s+untestable/i.test(t);
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

function defaultContributorRoles(): Record<ContributorRole, string> {
  return {
    Conceptualization: "",
    Methodology: "",
    Software: "",
    Validation: "",
    Writing: "",
    Visualization: "",
  };
}

function defaultDraft(): Draft {
  return {
    paperId: makeId("omega"),
    importedFrom: "Omega",
    title: "",
    doi: "",
    authorsText: "",
    responsibleStewardsText: "",
    contributorRoles: defaultContributorRoles(),
    nonHumanContributors: [],
    toolingChecklist: ["none"],
    toolingValidationNote: "",
    abstractStructured: {
      problem: "",
      approach: "",
      keyClaims: "",
      limitations: "",
    },
    discipline: "Digital Physics",
    articleType: "Theory Preprint",
    controlledKeywordsText: "",
    freeTagsText: "",
    license: "CC-BY-4.0",
    competingInterests: "None",
    funding: "None",
    falsifiabilityPath: "",
    falsifiabilityCurrentlyUntestable: false,
    falsifiabilityDependencies: "",
    falsifiabilityTrigger: "",
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
  const responsibleStewards = parseUniqueCsv(draft.responsibleStewardsText);
  const keywords = parseUniqueCsv(draft.controlledKeywordsText).slice(0, 5);
  const tags = parseUniqueCsv(draft.freeTagsText).slice(0, 10);
  const abstractStructured: StructuredAbstract = {
    problem: draft.abstractStructured.problem.trim(),
    approach: draft.abstractStructured.approach.trim(),
    keyClaims: draft.abstractStructured.keyClaims.trim(),
    limitations: draft.abstractStructured.limitations.trim(),
  };
  const abstractJoined = [abstractStructured.problem, abstractStructured.approach, abstractStructured.keyClaims, abstractStructured.limitations]
    .filter(Boolean)
    .join("\n\n");

  const contributorRoles = (() => {
    const out: Partial<Record<ContributorRole, string[]>> = {};
    for (const role of CONTRIBUTOR_ROLE_OPTIONS) {
      const names = parseUniqueCsv(draft.contributorRoles[role.id] || "");
      if (names.length) out[role.id] = names;
    }
    return Object.keys(out).length ? out : undefined;
  })();

  const nonHumanContributors: NonHumanContributor[] = (draft.nonHumanContributors || [])
    .map((c) => {
      const name = (c?.name || "").trim();
      if (!name) return null;
      const versionOrId = (c?.versionOrId || "").trim();
      const scope = (c?.scope || "").trim();
      const promptStrategy = (c?.promptStrategy || "").trim();
      const validationSummary = (c?.validationSummary || "").trim();
      const out: NonHumanContributor = { name };
      if (versionOrId) out.versionOrId = versionOrId;
      if (scope) out.scope = scope;
      if (promptStrategy) out.promptStrategy = promptStrategy;
      if (validationSummary) out.validationSummary = validationSummary;
      return out;
    })
    .filter(Boolean) as NonHumanContributor[];

  return {
    id: draft.paperId,
    title: draft.title || "Untitled Submission",
    abstract: abstractJoined || "No abstract provided.",
    abstractStructured,
    provenanceStatement: formatProvenanceStatement({
      toolingChecklist: draft.toolingChecklist,
      toolingValidationNote: draft.toolingValidationNote,
    }),
    responsibleStewards: responsibleStewards.length ? responsibleStewards : undefined,
    contributorRoles,
    nonHumanContributors: nonHumanContributors.length ? nonHumanContributors : undefined,
    doi: draft.doi || "N/A",
    collectionVolume: draft.collectionVolume || "Omega Submissions",
    level: 0,
    articleType: draft.articleType,
    discipline: draft.discipline,
    keywords,
    tags,
    license: draft.license.trim() || undefined,
    competingInterests: draft.competingInterests.trim() || undefined,
    funding: draft.funding.trim() || undefined,
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
    falsifiabilityPath: (() => {
      const path = draft.falsifiabilityPath.trim();
      if (!path) return "N/A";
      const untestable = draft.falsifiabilityCurrentlyUntestable || seemsCurrentlyUntestable(path);
      if (!untestable) return path;
      const dep = draft.falsifiabilityDependencies.trim();
      const trig = draft.falsifiabilityTrigger.trim();
      const extra: string[] = [];
      if (dep) extra.push(`DEPENDENCIES: ${dep}`);
      if (trig) extra.push(`FUTURE_TEST_TRIGGER: ${trig}`);
      return extra.length ? `${path}\n\n${extra.join("\n")}` : path;
    })(),
  };
}

type SubmissionGateIssue = {
  id: string;
  en: string;
  zh: string;
};

function getSubmissionGateState(draft: Draft) {
  const issues: SubmissionGateIssue[] = [];

  if (!draft.title.trim()) {
    issues.push({ id: "title", en: "Title is required.", zh: "Title 必填。" });
  }

  const authors = parseCsv(draft.authorsText);
  if (!authors.length) {
    issues.push({ id: "authors", en: "Authors list is required.", zh: "Authors 列表必填。" });
  }

  const stewards = parseCsv(draft.responsibleStewardsText);
  if (!stewards.length) {
    issues.push({
      id: "responsible_steward",
      en: "Responsible Steward is required (at least one accountable human/organization).",
      zh: "Responsible Steward 必填（至少 1 位责任主体：人/组织）。",
    });
  }

  const anyRoleFilled = CONTRIBUTOR_ROLE_OPTIONS.some((r) => parseCsv(draft.contributorRoles[r.id] || "").length > 0);
  if (!anyRoleFilled) {
    issues.push({
      id: "contributor_roles",
      en: "Contributor Roles are required (assign at least one role).",
      zh: "Contributor Roles 必填（至少填写 1 个角色及其贡献者）。",
    });
  }

  if (!draft.toolingChecklist.length) {
    issues.push({
      id: "tooling_checklist",
      en: "Tooling Checklist is required (select “None” if none).",
      zh: "Tooling Checklist 必填（无则选择 “None/无”）。",
    });
  }
  if (draft.toolingChecklist.includes("none") && draft.toolingChecklist.length > 1) {
    issues.push({
      id: "tooling_none_exclusive",
      en: "Tooling Checklist: “None” cannot be selected with other items.",
      zh: "Tooling Checklist：选择 “None/无” 时不能同时选择其他项。",
    });
  }
  if (requiresToolingValidation(draft.toolingChecklist) && !draft.toolingValidationNote.trim()) {
    issues.push({
      id: "tooling_validation_note",
      en: "Validation Note is required for tooling that affects conclusions.",
      zh: "当工具会影响结论时，Validation Note 必填。",
    });
  }

  if (!draft.abstractStructured.problem.trim()) {
    issues.push({ id: "abs_problem", en: "Abstract[Problem] is required.", zh: "摘要 Problem 必填。" });
  }
  if (!draft.abstractStructured.approach.trim()) {
    issues.push({ id: "abs_approach", en: "Abstract[Approach] is required.", zh: "摘要 Approach 必填。" });
  }
  if (!draft.abstractStructured.keyClaims.trim()) {
    issues.push({ id: "abs_keyClaims", en: "Abstract[Key Claims] is required.", zh: "摘要 Key Claims 必填。" });
  }
  if (!draft.abstractStructured.limitations.trim()) {
    issues.push({ id: "abs_limitations", en: "Abstract[Limitations] is required.", zh: "摘要 Limitations 必填。" });
  }

  const controlledKeywords = parseUniqueCsv(draft.controlledKeywordsText);
  if (controlledKeywords.length < 2 || controlledKeywords.length > 5) {
    issues.push({
      id: "controlled_keywords",
      en: "Controlled Keywords must contain 2–5 items.",
      zh: "Controlled Keywords 必须为 2–5 个。",
    });
  }

  const freeTags = parseUniqueCsv(draft.freeTagsText);
  if (freeTags.length > 10) {
    issues.push({ id: "free_tags", en: "Free Tags must contain 0–10 items.", zh: "Free Tags 最多 10 个。" });
  }

  if (!draft.license.trim()) {
    issues.push({ id: "license", en: "License is required.", zh: "License 必填。" });
  }

  if (!draft.competingInterests.trim()) {
    issues.push({ id: "competing_interests", en: "Competing Interests is required (write “None” if none).", zh: "Competing Interests 必填（无也要写 None）。" });
  }

  if (!draft.funding.trim()) {
    issues.push({ id: "funding", en: "Funding is required (write “None” if none).", zh: "Funding 必填（无也要写 None）。" });
  }

  if (!draft.falsifiabilityPath.trim()) {
    issues.push({
      id: "falsifiability_path",
      en: "Falsifiability Path is required (at least one test path).",
      zh: "可证伪路径必填（至少写 1 条可检验路径）。",
    });
  } else {
    const path = draft.falsifiabilityPath.trim();
    const needsFutureGate = draft.falsifiabilityCurrentlyUntestable || seemsCurrentlyUntestable(path);
    if (needsFutureGate) {
      if (!draft.falsifiabilityDependencies.trim()) {
        issues.push({
          id: "falsifiability_dependencies",
          en: "Dependency conditions are required when the path is currently untestable.",
          zh: "若目前不可检验，必须写清依赖条件。",
        });
      }
      if (!draft.falsifiabilityTrigger.trim()) {
        issues.push({
          id: "falsifiability_trigger",
          en: "Future test trigger is required when the path is currently untestable.",
          zh: "若目前不可检验，必须写清未来可检验触发点。",
        });
      }
    }
  }

  return { issues, controlledKeywords, freeTags };
}

type ClaimsGateIssue = {
  id: string;
  en: string;
  zh: string;
};

function getClaimsGateState(claimEvidence: ClaimEvidence[]) {
  const issues: ClaimsGateIssue[] = [];

  if (!claimEvidence.length) {
    issues.push({
      id: "claims_empty",
      en: "Claims List is required (add at least 1 claim).",
      zh: "主张清单必填（至少添加 1 条主张）。",
    });
    return { issues, total: 0, withSourceRef: 0 };
  }

  let withSourceRef = 0;

  claimEvidence.forEach((c, idx) => {
    const cid = `C${idx + 1}`;
    const claimText = (c.claim || "").trim();
    const sourceRef = (c.sourceRef || "").trim();

    if (!claimText) {
      issues.push({
        id: `claim_text:${cid}`,
        en: `${cid}: claim text is required.`,
        zh: `${cid}：主张内容必填。`,
      });
    }

    if (!sourceRef) {
      issues.push({
        id: `claim_source_ref:${cid}`,
        en: `${cid}: source reference is required (paragraph / proposition / theorem id).`,
        zh: `${cid}：必须填写正文锚点（段落/命题/定理编号）。`,
      });
    } else {
      withSourceRef += 1;
    }
  });

  return { issues, total: claimEvidence.length, withSourceRef };
}

type AssumptionGateIssue = {
  id: string;
  en: string;
  zh: string;
};

function getAssumptionGateState(assumptionLedger: AssumptionLedgerEntry[]) {
  const issues: AssumptionGateIssue[] = [];

  if (!assumptionLedger.length) {
    issues.push({
      id: "assumptions_empty",
      en: "Assumption Ledger is required (add at least 1 assumption).",
      zh: "假设清单必填（至少添加 1 条假设）。",
    });
    return { issues, total: 0, complete: 0 };
  }

  let complete = 0;

  assumptionLedger.forEach((a, idx) => {
    const aid = `A${idx + 1}`;
    const assumption = (a.assumption || "").trim();
    const whyNeeded = (a.whyNeeded || "").trim();
    const falsify = (a.falsify || "").trim();

    let ok = true;

    if (!assumption) {
      ok = false;
      issues.push({
        id: `assumption_text:${aid}`,
        en: `${aid}: assumption text is required.`,
        zh: `${aid}：假设内容必填。`,
      });
    }

    if (!whyNeeded) {
      ok = false;
      issues.push({
        id: `assumption_why:${aid}`,
        en: `${aid}: “Why needed” is required.`,
        zh: `${aid}：“Why needed / 为什么需要”必填。`,
      });
    }

    if (!falsify) {
      ok = false;
      issues.push({
        id: `assumption_falsify:${aid}`,
        en: `${aid}: “What would falsify it” is required.`,
        zh: `${aid}：“What would falsify it / 什么会证伪它”必填。`,
      });
    }

    if (ok) complete += 1;
  });

  return { issues, total: assumptionLedger.length, complete };
}

type PriorWorkGateIssue = {
  id: string;
  en: string;
  zh: string;
};

function getPriorWorkGateState(priorWork: PriorWorkEntry[]) {
  const issues: PriorWorkGateIssue[] = [];

  if (priorWork.length < 5) {
    issues.push({
      id: "prior_work_min",
      en: "Relation to Prior Work is required (at least 5 references).",
      zh: "相关工作必填（至少 5 条文献）。",
    });
  }

  let complete = 0;

  priorWork.forEach((w, idx) => {
    const rid = `R${idx + 1}`;
    const citation = (w.citation || "").trim();
    const inherits = (w.inherits || "").trim();
    const conflicts = (w.conflicts || "").trim();
    const differs = (w.differs || "").trim();

    let ok = true;

    if (!citation) {
      ok = false;
      issues.push({
        id: `prior_work_citation:${rid}`,
        en: `${rid}: citation is required.`,
        zh: `${rid}：文献条目必填。`,
      });
    }
    if (!inherits) {
      ok = false;
      issues.push({
        id: `prior_work_inherits:${rid}`,
        en: `${rid}: “Inheritance / builds on” is required.`,
        zh: `${rid}：继承点必填。`,
      });
    }
    if (!conflicts) {
      ok = false;
      issues.push({
        id: `prior_work_conflicts:${rid}`,
        en: `${rid}: “Conflict / disagreement” is required.`,
        zh: `${rid}：冲突点必填。`,
      });
    }
    if (!differs) {
      ok = false;
      issues.push({
        id: `prior_work_differs:${rid}`,
        en: `${rid}: “Difference / novelty” is required.`,
        zh: `${rid}：差异点必填。`,
      });
    }

    if (ok) complete += 1;
  });

  return { issues, total: priorWork.length, complete };
}

function safeParseSubmissionStore(raw: string | null): SubmissionStoreV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;

    const version = obj.version;
    if (version !== 2 && version !== 1) return null;

    const baseDraft = defaultDraft();
    const rawDraft = obj.draft;
    if (!rawDraft || typeof rawDraft !== "object") return null;

    const draftObj = rawDraft as Partial<Record<string, unknown>>;
    const importedFrom = draftObj.importedFrom;
    const discipline = draftObj.discipline;
    const articleType = draftObj.articleType;
    const abs = draftObj.abstractStructured;
    const absObj = abs && typeof abs === "object" ? (abs as Record<string, unknown>) : null;
    const legacyKeywordsText = draftObj.keywordsText;
    const legacyAbstract = draftObj.abstract;
    const legacyProvenance = draftObj.provenanceStatement;
    const rolesObj = draftObj.contributorRoles && typeof draftObj.contributorRoles === "object" ? (draftObj.contributorRoles as Record<string, unknown>) : null;

    const parsedChecklist = normalizeToolingChecklist(draftObj.toolingChecklist);
    const parsedValidationNote = typeof draftObj.toolingValidationNote === "string" ? (draftObj.toolingValidationNote as string) : "";
    const legacyStatement = typeof legacyProvenance === "string" ? (legacyProvenance as string).trim() : "";
    const legacyIsNone = legacyStatement ? /^none\b/i.test(legacyStatement) : false;
    const derivedChecklist = (() => {
      if (parsedChecklist.length) return parsedChecklist;
      if (!legacyStatement) return baseDraft.toolingChecklist;
      if (legacyIsNone) return ["none"] as ToolingChecklistItem[];
      const t = legacyStatement.toLowerCase();
      const out = new Set<ToolingChecklistItem>();
      if (/(gpt|llm|ai|claude|gemini|writing|edit)/i.test(t)) out.add("writing_editing");
      if (/(code|copilot|cursor|generated\s+code|codegen|pipeline)/i.test(t)) out.add("code_generation");
      if (/(synthetic\s+data|data\s+generation|generated\s+data)/i.test(t)) out.add("data_generation");
      if (/(theorem|proof|prover|lean|coq|isabelle)/i.test(t)) out.add("theorem_proof_search");
      if (/(citation|references|literature|bibtex)/i.test(t)) out.add("citation_assistance");
      if (!out.size) out.add("writing_editing");
      return Array.from(out);
    })();
    const derivedValidationNote = parsedValidationNote || (legacyIsNone ? "" : legacyStatement);

    const nextDraft: Draft = {
      ...baseDraft,
      paperId: typeof draftObj.paperId === "string" ? draftObj.paperId : baseDraft.paperId,
      importedFrom:
        importedFrom === "Zenodo" || importedFrom === "Omega" || importedFrom === "arXiv" ? (importedFrom as Paper["importedFrom"]) : baseDraft.importedFrom,
      title: typeof draftObj.title === "string" ? (draftObj.title as string) : baseDraft.title,
      doi: typeof draftObj.doi === "string" ? (draftObj.doi as string) : baseDraft.doi,
      authorsText: typeof draftObj.authorsText === "string" ? (draftObj.authorsText as string) : baseDraft.authorsText,
      responsibleStewardsText:
        typeof draftObj.responsibleStewardsText === "string" ? (draftObj.responsibleStewardsText as string) : baseDraft.responsibleStewardsText,
      contributorRoles: (() => {
        const base = baseDraft.contributorRoles;
        if (!rolesObj) return base;
        const out: Record<ContributorRole, string> = { ...base };
        for (const role of CONTRIBUTOR_ROLE_OPTIONS) {
          const rawRole = rolesObj[role.id];
          if (typeof rawRole === "string") out[role.id] = rawRole;
        }
        return out;
      })(),
      nonHumanContributors: (() => {
        const rawContrib = draftObj.nonHumanContributors;
        if (!Array.isArray(rawContrib)) return baseDraft.nonHumanContributors;
        const out: NonHumanContributorDraft[] = [];
        for (const raw of rawContrib) {
          if (!raw || typeof raw !== "object") continue;
          const obj = raw as Record<string, unknown>;
          out.push({
            name: typeof obj.name === "string" ? obj.name : "",
            versionOrId: typeof obj.versionOrId === "string" ? obj.versionOrId : "",
            scope: typeof obj.scope === "string" ? obj.scope : "",
            promptStrategy: typeof obj.promptStrategy === "string" ? obj.promptStrategy : "",
            validationSummary: typeof obj.validationSummary === "string" ? obj.validationSummary : "",
          });
        }
        return out;
      })(),
      toolingChecklist: derivedChecklist,
      toolingValidationNote: derivedValidationNote,
      discipline:
        discipline === "Digital Physics" ||
        discipline === "Cellular Automata" ||
        discipline === "Thermodynamics" ||
        discipline === "AI Foundations" ||
        discipline === "Cosmology"
          ? (discipline as Paper["discipline"])
          : baseDraft.discipline,
      articleType:
        articleType === "Theory Preprint" ||
        articleType === "Conjecture Note" ||
        articleType === "Proof or Formal Derivation" ||
        articleType === "Computational Experiment" ||
        articleType === "Verification Report" ||
        articleType === "Replication Report" ||
        articleType === "Negative Result" ||
        articleType === "Survey or Synthesis" ||
        articleType === "Critique or Commentary"
          ? (articleType as Paper["articleType"])
          : baseDraft.articleType,
      abstractStructured:
        absObj
          ? {
              problem: typeof absObj.problem === "string" ? absObj.problem : "",
              approach: typeof absObj.approach === "string" ? absObj.approach : "",
              keyClaims: typeof absObj.keyClaims === "string" ? absObj.keyClaims : "",
              limitations: typeof absObj.limitations === "string" ? absObj.limitations : "",
            }
          : baseDraft.abstractStructured,
      controlledKeywordsText:
        typeof draftObj.controlledKeywordsText === "string"
          ? (draftObj.controlledKeywordsText as string)
          : typeof legacyKeywordsText === "string"
            ? legacyKeywordsText
            : baseDraft.controlledKeywordsText,
      freeTagsText: typeof draftObj.freeTagsText === "string" ? (draftObj.freeTagsText as string) : baseDraft.freeTagsText,
      license: typeof draftObj.license === "string" ? (draftObj.license as string) : baseDraft.license,
      competingInterests:
        typeof draftObj.competingInterests === "string" ? (draftObj.competingInterests as string) : baseDraft.competingInterests,
      funding: typeof draftObj.funding === "string" ? (draftObj.funding as string) : baseDraft.funding,
      falsifiabilityPath: typeof draftObj.falsifiabilityPath === "string" ? (draftObj.falsifiabilityPath as string) : baseDraft.falsifiabilityPath,
      falsifiabilityCurrentlyUntestable:
        typeof draftObj.falsifiabilityCurrentlyUntestable === "boolean"
          ? (draftObj.falsifiabilityCurrentlyUntestable as boolean)
          : baseDraft.falsifiabilityCurrentlyUntestable,
      falsifiabilityDependencies:
        typeof draftObj.falsifiabilityDependencies === "string"
          ? (draftObj.falsifiabilityDependencies as string)
          : baseDraft.falsifiabilityDependencies,
      falsifiabilityTrigger:
        typeof draftObj.falsifiabilityTrigger === "string"
          ? (draftObj.falsifiabilityTrigger as string)
          : baseDraft.falsifiabilityTrigger,
      collectionVolume: typeof draftObj.collectionVolume === "string" ? (draftObj.collectionVolume as string) : baseDraft.collectionVolume,
      aiContributionPercent:
        typeof draftObj.aiContributionPercent === "string" ? (draftObj.aiContributionPercent as string) : baseDraft.aiContributionPercent,
      codeUrl: typeof draftObj.codeUrl === "string" ? (draftObj.codeUrl as string) : baseDraft.codeUrl,
      codeCommit: typeof draftObj.codeCommit === "string" ? (draftObj.codeCommit as string) : baseDraft.codeCommit,
      codeHash: typeof draftObj.codeHash === "string" ? (draftObj.codeHash as string) : baseDraft.codeHash,
      dataUrl: typeof draftObj.dataUrl === "string" ? (draftObj.dataUrl as string) : baseDraft.dataUrl,
      dataHash: typeof draftObj.dataHash === "string" ? (draftObj.dataHash as string) : baseDraft.dataHash,
    };

    if (version === 1 && typeof legacyAbstract === "string") {
      nextDraft.abstractStructured = {
        problem: legacyAbstract,
        approach: "",
        keyClaims: "",
        limitations: "",
      };
    }

    return {
      version: 2,
      draft: nextDraft,
      evidencePointers: Array.isArray(obj.evidencePointers) ? (obj.evidencePointers as EvidencePointer[]) : [],
      claimEvidence: Array.isArray(obj.claimEvidence) ? (obj.claimEvidence as ClaimEvidence[]) : [],
      assumptionLedger: Array.isArray(obj.assumptionLedger) ? (obj.assumptionLedger as AssumptionLedgerEntry[]) : [],
      priorWork: Array.isArray(obj.priorWork) ? (obj.priorWork as PriorWorkEntry[]) : [],
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

function safeParseEvidenceStore(
  raw: string | null
): {
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
  assumptionLedger: AssumptionLedgerEntry[];
  priorWork: PriorWorkEntry[];
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<{ version: number; evidencePointers: unknown; claimEvidence: unknown; assumptionLedger: unknown; priorWork: unknown }>;
    if (obj.version !== 1) return null;
    return {
      evidencePointers: Array.isArray(obj.evidencePointers) ? (obj.evidencePointers as EvidencePointer[]) : [],
      claimEvidence: Array.isArray(obj.claimEvidence) ? (obj.claimEvidence as ClaimEvidence[]) : [],
      assumptionLedger: Array.isArray(obj.assumptionLedger) ? (obj.assumptionLedger as AssumptionLedgerEntry[]) : [],
      priorWork: Array.isArray(obj.priorWork) ? (obj.priorWork as PriorWorkEntry[]) : [],
    };
  } catch {
    return null;
  }
}

function buildUserContext(
  userContext: string,
  selfReport: SelfReport,
  evidencePointers: EvidencePointer[],
  claimEvidence: ClaimEvidence[],
  assumptionLedger: AssumptionLedgerEntry[],
  priorWork: PriorWorkEntry[],
  paper: Paper
) {
  const lines: string[] = [];
  if (selfReport.usesMl) lines.push("SELF_REPORT: uses_ml=yes");
  lines.push(`SELF_REPORT: train_test_split=${selfReport.trainTestSplit}`);
  lines.push(`SELF_REPORT: preregistered=${selfReport.preregistered}`);
  lines.push(`SELF_REPORT: multiple_hypotheses=${selfReport.multipleHypotheses}`);
  lines.push(`SELF_REPORT: power_analysis=${selfReport.powerAnalysis}`);
  if (selfReport.sampleSize.trim()) lines.push(`SELF_REPORT: sample_size=${selfReport.sampleSize.trim()}`);
  if (evidencePointers.length) lines.push(`EVIDENCE_POINTERS: ${evidencePointers.length}`);
  if (claimEvidence.length) lines.push(`CLAIMS: ${claimEvidence.length}`);
  if (assumptionLedger.length) lines.push(`ASSUMPTIONS: ${assumptionLedger.length}`);

  const header = lines.join("\n");
  const stewardshipText = paper.responsibleStewards?.length
    ? `\n\nRESPONSIBLE_STEWARD:\n${paper.responsibleStewards.join("; ")}`
    : "";
  const contributorRolesText = paper.contributorRoles
    ? `\n\nCONTRIBUTOR_ROLES:\n${Object.entries(paper.contributorRoles)
        .map(([role, names]) => {
          const list = Array.isArray(names) ? names.filter(Boolean) : [];
          if (!list.length) return null;
          return `${role}: ${list.join("; ")}`;
        })
        .filter(Boolean)
        .join("\n")}`
    : "";
  const nonHumanText = paper.nonHumanContributors?.length
    ? `\n\nNON_HUMAN_CONTRIBUTORS:\n${paper.nonHumanContributors
        .map((c) => {
          const parts: string[] = [`NAME: ${c.name}`];
          if (c.versionOrId) parts.push(`VERSION_OR_ID: ${c.versionOrId}`);
          if (c.scope) parts.push(`SCOPE: ${c.scope}`);
          if (c.promptStrategy) parts.push(`PROMPT_STRATEGY: ${c.promptStrategy}`);
          if (c.validationSummary) parts.push(`VALIDATION: ${c.validationSummary}`);
          return parts.join("\n");
        })
        .join("\n\n")}`
    : "";
  const provenanceText = (paper.provenanceStatement || "").trim()
    ? `\n\nPROVENANCE_AND_TOOLING_STATEMENT:\n${(paper.provenanceStatement || "").trim()}`
    : "";
  const assumptionText = assumptionLedger.length
    ? `\n\nASSUMPTION_LEDGER:\n${assumptionLedger
        .map((a, idx) => {
          const id = `A${idx + 1}`;
          const assumption = (a.assumption || "").trim();
          const whyNeeded = (a.whyNeeded || "").trim();
          const falsify = (a.falsify || "").trim();
          return [
            `${id}. ASSUMPTION: ${assumption}`,
            whyNeeded ? `WHY_NEEDED: ${whyNeeded}` : null,
            falsify ? `FALSIFY: ${falsify}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")}`
    : "";

  const priorWorkText = priorWork.length
    ? `\n\nPRIOR_WORK_ALIGNMENT:\n${priorWork
        .map((w, idx) => {
          const id = `R${idx + 1}`;
          const citation = (w.citation || "").trim();
          const inherits = (w.inherits || "").trim();
          const conflicts = (w.conflicts || "").trim();
          const differs = (w.differs || "").trim();
          return [
            `${id}. CITATION: ${citation}`,
            inherits ? `INHERITS: ${inherits}` : null,
            conflicts ? `CONFLICTS: ${conflicts}` : null,
            differs ? `DIFFERS: ${differs}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")}`
    : "";

  const extra = userContext.trim();
  const base = `${header}${stewardshipText}${contributorRolesText}${nonHumanText}${provenanceText}${assumptionText}${priorWorkText}`.trim();
  return extra ? `${base}\n\nAUTHOR_CONTEXT:\n${extra}` : base;
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
  const [assumptionLedger, setAssumptionLedger] = useState<AssumptionLedgerEntry[]>([]);
  const [priorWork, setPriorWork] = useState<PriorWorkEntry[]>([]);
  const [aiReviewAt, setAiReviewAt] = useState<string | null>(null);
  const [defenseDeadlineAt, setDefenseDeadlineAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const paper = useMemo(() => draftToPaper(draft), [draft]);
  const reviewContext = useMemo(
    () =>
      buildUserContext(
        userContext,
        selfReport,
        evidencePointers,
        claimEvidence,
        assumptionLedger,
        priorWork,
        paper
      ),
    [assumptionLedger, claimEvidence, evidencePointers, paper, priorWork, selfReport, userContext]
  );
  const riskReport = useMemo(
    () => computeRiskReport({ paper, evidencePointers, claimEvidence, selfReport }),
    [claimEvidence, evidencePointers, paper, selfReport]
  );
  const submissionGate = useMemo(() => getSubmissionGateState(draft), [draft]);
  const claimsGate = useMemo(() => getClaimsGateState(claimEvidence), [claimEvidence]);
  const assumptionGate = useMemo(() => getAssumptionGateState(assumptionLedger), [assumptionLedger]);
  const priorWorkGate = useMemo(() => getPriorWorkGateState(priorWork), [priorWork]);

  useEffect(() => {
    const stored =
      safeParseSubmissionStore(localStorage.getItem(SUBMISSION_STORE_KEY)) ||
      safeParseSubmissionStore(localStorage.getItem(LEGACY_SUBMISSION_STORE_KEY));
    if (!stored) return;
    setDraft(stored.draft);
    setEvidencePointers(stored.evidencePointers);
    setClaimEvidence(stored.claimEvidence);
    setAssumptionLedger(stored.assumptionLedger);
    setPriorWork(stored.priorWork);
    setEngine(stored.engine);
    setUserContext(stored.userContext);
    setSelfReport(stored.selfReport);
    setAiReviewAt(stored.aiReviewAt);
    setDefenseDeadlineAt(stored.defenseDeadlineAt);
  }, []);

  useEffect(() => {
    const payload: SubmissionStoreV2 = {
      version: 2,
      draft,
      evidencePointers,
      claimEvidence,
      assumptionLedger,
      priorWork,
      engine,
      userContext,
      selfReport,
      aiReviewAt,
      defenseDeadlineAt,
    };
    localStorage.setItem(SUBMISSION_STORE_KEY, JSON.stringify(payload));
  }, [aiReviewAt, assumptionLedger, claimEvidence, defenseDeadlineAt, draft, engine, evidencePointers, priorWork, selfReport, userContext]);

  useEffect(() => {
    const key = evidenceStorageKey(paper.id);
    const stored = safeParseEvidenceStore(localStorage.getItem(key));
    if (stored) {
      setEvidencePointers(stored.evidencePointers);
      setClaimEvidence(stored.claimEvidence);
      setAssumptionLedger(stored.assumptionLedger);
      setPriorWork(stored.priorWork);
    } else {
      setEvidencePointers([]);
      setClaimEvidence([]);
      setAssumptionLedger([]);
      setPriorWork([]);
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
        assumptionLedger,
        priorWork,
      })
    );
  }, [assumptionLedger, claimEvidence, evidencePointers, paper.id, priorWork]);

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
        assumptionLedger,
        priorWork,
        aiReviewAt,
        defenseDeadlineAt,
      })
    );
  }, [aiReviewAt, assumptionLedger, defenseDeadlineAt, paper, priorWork, selfReport, userContext]);

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
    setAssumptionLedger([]);
    setPriorWork([]);
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
      const kw = (p.keywords || []).map((k) => String(k)).filter(Boolean);
      const controlled = kw.slice(0, 5);
      const freeTags = kw.slice(5, 15);
      const firstAuthor = p.authors?.[0]?.name ? String(p.authors[0].name) : "";
      setDraft({
        paperId: p.id,
        importedFrom: p.importedFrom,
        title: p.title,
        doi: p.doi,
        authorsText: p.authors.map((a) => a.name).join(", "),
        responsibleStewardsText: firstAuthor,
        contributorRoles: { ...defaultContributorRoles(), Writing: firstAuthor },
        nonHumanContributors: [],
        abstractStructured: p.abstractStructured || {
          problem: p.abstract || "",
          approach: "",
          keyClaims: "",
          limitations: "",
        },
        toolingChecklist: ["none"],
        toolingValidationNote: "",
        discipline: p.discipline,
        articleType: p.articleType,
        controlledKeywordsText: controlled.join(", "),
        freeTagsText: freeTags.join(", "),
        license: p.license || "Unknown",
        competingInterests: p.competingInterests || "None",
        funding: p.funding || "None",
        falsifiabilityPath: p.falsifiabilityPath || "",
        falsifiabilityCurrentlyUntestable: false,
        falsifiabilityDependencies: "",
        falsifiabilityTrigger: "",
        collectionVolume: p.collectionVolume || "Zenodo Import",
        aiContributionPercent: String(p.aiContributionPercent ?? 0),
        codeUrl: p.codeUrl || "",
        codeCommit: "",
        codeHash: p.codeHash || "",
        dataUrl: p.dataUrl || "",
        dataHash: "",
      });
      setAssumptionLedger([]);
      setPriorWork([]);

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
    const metaGate = getSubmissionGateState(draft);
    const claimGate = getClaimsGateState(claimEvidence);
    const assumptionGate = getAssumptionGateState(assumptionLedger);
    const priorWorkGate = getPriorWorkGateState(priorWork);
    if (
      metaGate.issues.length > 0 ||
      claimGate.issues.length > 0 ||
      assumptionGate.issues.length > 0 ||
      priorWorkGate.issues.length > 0
    ) {
      setRunStatus("error");
      setRunError(
        "Submission gate blocked: complete required metadata + authors/stewardship + provenance/tooling + claims list + assumption ledger + falsifiability path + relation to prior work fields before running AI review."
      );
      return;
    }

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
    setClaimEvidence((prev) => [...prev, { claim: "", sourceRef: "", evidenceIds: [] }]);
  };

  const updateClaimText = (idx: number, claim: string) => {
    setClaimEvidence((prev) => prev.map((c, i) => (i === idx ? { ...c, claim } : c)));
  };

  const updateClaimSourceRef = (idx: number, sourceRef: string) => {
    setClaimEvidence((prev) => prev.map((c, i) => (i === idx ? { ...c, sourceRef } : c)));
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

  const addAssumption = () => {
    setAssumptionLedger((prev) => [...prev, { assumption: "", whyNeeded: "", falsify: "" }]);
  };

  const updateAssumption = (idx: number, patch: Partial<AssumptionLedgerEntry>) => {
    setAssumptionLedger((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const removeAssumption = (idx: number) => {
    setAssumptionLedger((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPriorWork = () => {
    setPriorWork((prev) => [...prev, { citation: "", inherits: "", conflicts: "", differs: "" }]);
  };

  const updatePriorWork = (idx: number, patch: Partial<PriorWorkEntry>) => {
    setPriorWork((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const removePriorWork = (idx: number) => {
    setPriorWork((prev) => prev.filter((_, i) => i !== idx));
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
                {submissionGate.issues.length ? (
                  <div className="border border-red-900/40 bg-red-950/20 p-3 space-y-2">
                    <div className="text-xs font-mono text-red-300">SUBMISSION_GATE_BLOCKED</div>
                    <div className="text-xs text-zinc-500">
                      Controlled Keywords: {submissionGate.controlledKeywords.length}/5 • Free Tags: {submissionGate.freeTags.length}/10
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-200">
                      {submissionGate.issues.map((it) => (
                        <li key={it.id}>
                          {it.en} / {it.zh}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-1">
                    <div className="text-xs font-mono text-emerald-400">SUBMISSION_GATE_PASS</div>
                    <div className="text-xs text-zinc-500">
                      Controlled Keywords: {submissionGate.controlledKeywords.length}/5 • Free Tags: {submissionGate.freeTags.length}/10
                    </div>
                  </div>
                )}

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
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-mono text-zinc-500">RESPONSIBLE_STEWARD (required)</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
                      onClick={() => {
                        const first = parseCsv(draft.authorsText)[0];
                        if (!first) return;
                        setDraft((p) => ({ ...p, responsibleStewardsText: first }));
                      }}
                      disabled={!parseCsv(draft.authorsText).length}
                    >
                      USE_FIRST_AUTHOR
                    </Button>
                  </div>
                  <Input
                    value={draft.responsibleStewardsText}
                    onChange={(e) => setDraft((p) => ({ ...p, responsibleStewardsText: e.target.value }))}
                    placeholder="At least one accountable human/organization (comma-separated)"
                  />
                  <div className="text-xs text-zinc-600">
                    This does not deny AI contributions. It ensures at least one accountable steward for corrections and appeals. / 这不是否定 AI 贡献，而是确保至少有一位可追责的责任主体，便于纠错与申诉。
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">CONTRIBUTOR_ROLES (required, CRediT-style)</label>
                  <div className="text-xs text-zinc-600">
                    Assign at least one role to keep contributions auditable and reusable. / 至少填写 1 个角色，便于贡献可追踪、可复用。
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CONTRIBUTOR_ROLE_OPTIONS.map((role) => (
                      <div key={role.id} className="space-y-1">
                        <div className="text-xs font-mono text-zinc-500">
                          {role.labelEn} <span className="text-zinc-700">/</span> {role.labelZh}
                        </div>
                        <Input
                          value={draft.contributorRoles[role.id]}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, contributorRoles: { ...p.contributorRoles, [role.id]: e.target.value } }))
                          }
                          placeholder="Names (comma-separated)"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">NON_HUMAN_CONTRIBUTORS (optional)</label>
                  <div className="text-xs text-zinc-600">
                    Record models/agents here to keep AI contributions visible without putting them in the author line. / 以单独模块记录模型/代理：既保留 AI 贡献可见性，也不在作者行制造伦理争议。
                  </div>
                  <div className="space-y-3">
                    {draft.nonHumanContributors.map((c, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-black/30 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-zinc-600">CONTRIBUTOR_{idx + 1}</div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-zinc-400 hover:text-red-300"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                nonHumanContributors: p.nonHumanContributors.filter((_, j) => j !== idx),
                              }))
                            }
                          >
                            REMOVE
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="text-xs font-mono text-zinc-500">MODEL_OR_AGENT_NAME</div>
                            <Input
                              value={c.name}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  nonHumanContributors: p.nonHumanContributors.map((it, j) => (j === idx ? { ...it, name: e.target.value } : it)),
                                }))
                              }
                              placeholder="e.g., GPT-4.1, Claude 3.5, Lean prover, Omega Agent"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-mono text-zinc-500">VERSION_OR_ID</div>
                            <Input
                              value={c.versionOrId}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  nonHumanContributors: p.nonHumanContributors.map((it, j) => (j === idx ? { ...it, versionOrId: e.target.value } : it)),
                                }))
                              }
                              placeholder="Version / identifier"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-mono text-zinc-500">SCOPE</div>
                          <textarea
                            value={c.scope}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                nonHumanContributors: p.nonHumanContributors.map((it, j) => (j === idx ? { ...it, scope: e.target.value } : it)),
                              }))
                            }
                            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                            placeholder="What it was used for (derivation, code, data, figures, editing, literature, etc.)"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-mono text-zinc-500">KEY_PARAMS_OR_PROMPT_STRATEGY (summary)</div>
                          <textarea
                            value={c.promptStrategy}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                nonHumanContributors: p.nonHumanContributors.map((it, j) => (j === idx ? { ...it, promptStrategy: e.target.value } : it)),
                              }))
                            }
                            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                            placeholder="Key parameters or prompt strategy summary (no secrets)"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-mono text-zinc-500">VALIDATION_METHOD (summary)</div>
                          <textarea
                            value={c.validationSummary}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                nonHumanContributors: p.nonHumanContributors.map((it, j) => (j === idx ? { ...it, validationSummary: e.target.value } : it)),
                              }))
                            }
                            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                            placeholder="How outputs were verified (recompute, cross-check, proof-check, reproduce, manual review...)"
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          nonHumanContributors: [
                            ...p.nonHumanContributors,
                            { name: "", versionOrId: "", scope: "", promptStrategy: "", validationSummary: "" },
                          ],
                        }))
                      }
                    >
                      ADD_NON_HUMAN_CONTRIBUTOR
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">PROVENANCE_AND_TOOLING_STATEMENT (required)</label>
                  <div className="space-y-2 border border-zinc-800 bg-black/30 p-3">
                    <div className="text-xs text-zinc-500 font-mono">A) TOOLING_CHECKLIST (required)</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {TOOLING_OPTIONS.map((opt) => {
                        const checked = draft.toolingChecklist.includes(opt.id);
                        return (
                          <label key={opt.id} className="flex items-start gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setDraft((p) => {
                                  const has = p.toolingChecklist.includes(opt.id);
                                  let next = has ? p.toolingChecklist.filter((id) => id !== opt.id) : [...p.toolingChecklist, opt.id];
                                  if (opt.id === "none") {
                                    next = has ? [] : ["none"];
                                  } else {
                                    next = next.filter((id) => id !== "none");
                                  }
                                  next = Array.from(new Set(next));
                                  return { ...p, toolingChecklist: next };
                                })
                              }
                              className="mt-1 h-4 w-4 accent-emerald-500"
                            />
                            <span className="leading-snug">
                              {opt.labelEn}
                              <span className="block text-xs text-zinc-500">{opt.labelZh}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="text-xs text-zinc-500 font-mono pt-2">B) VALIDATION_NOTE (conditional)</div>
                    <textarea
                      value={draft.toolingValidationNote}
                      onChange={(e) => setDraft((p) => ({ ...p, toolingValidationNote: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                      placeholder="Required when tooling affects conclusions (e.g., code generation/data generation/proof search): how you validated the outputs (recompute, cross-validate, proof-check, reproduce, manual step review, baseline comparisons)."
                    />
                    <div className="text-xs text-zinc-600">
                      {requiresToolingValidation(draft.toolingChecklist)
                        ? "Required: you selected tooling that may affect conclusions."
                        : "Optional: add verification notes if helpful."}{" "}
                      / {requiresToolingValidation(draft.toolingChecklist) ? "必填：你选择了可能影响结论的工具。" : "选填：如有需要可补充复核说明。"}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-600">
                    Do not call this “AI Disclosure”. The form should be a neutral description, not a moral judgment. / 不要叫 AI Disclosure。表单应该是中性描述，不是审判。
                  </div>
                  <div className="text-xs text-zinc-600">
                    Motivation (plain terms): we don’t care which tools you used; we care whether critical tool-influenced outputs were verified—like engineering requires dependency declarations and test reports. / 动机解释（给外行）：我们不是关心你用了什么工具，我们关心你用工具生成的关键内容有没有被验证过。就像工程里必须写依赖和测试报告。
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">ABSTRACT (structured)</label>
                  <div className="text-xs text-zinc-600">Required: Problem / Approach / Key Claims / Limitations</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">PROBLEM</label>
                      <textarea
                        value={draft.abstractStructured.problem}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, abstractStructured: { ...p.abstractStructured, problem: e.target.value } }))
                        }
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                        placeholder="What problem are you solving?"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">APPROACH</label>
                      <textarea
                        value={draft.abstractStructured.approach}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, abstractStructured: { ...p.abstractStructured, approach: e.target.value } }))
                        }
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                        placeholder="What is your approach/method?"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">KEY CLAIMS</label>
                      <textarea
                        value={draft.abstractStructured.keyClaims}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, abstractStructured: { ...p.abstractStructured, keyClaims: e.target.value } }))
                        }
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                        placeholder="List the key claims (high-level)."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500">LIMITATIONS</label>
                      <textarea
                        value={draft.abstractStructured.limitations}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, abstractStructured: { ...p.abstractStructured, limitations: e.target.value } }))
                        }
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                        placeholder="Known limitations, risks, or non-goals."
                      />
                    </div>
                  </div>
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
                    <label className="text-xs font-mono text-zinc-500">LICENSE</label>
                    <Input
                      value={draft.license}
                      onChange={(e) => setDraft((p) => ({ ...p, license: e.target.value }))}
                      placeholder="e.g. CC-BY-4.0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">CONTROLLED_KEYWORDS (2–5, comma-separated)</label>
                    <Input
                      value={draft.controlledKeywordsText}
                      onChange={(e) => setDraft((p) => ({ ...p, controlledKeywordsText: e.target.value }))}
                      placeholder="e.g. cellular automata, entropy"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">FREE_TAGS (0–10, optional)</label>
                    <Input
                      value={draft.freeTagsText}
                      onChange={(e) => setDraft((p) => ({ ...p, freeTagsText: e.target.value }))}
                      placeholder="e.g. speculative, notebook, lecture"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">COMPETING_INTERESTS (required)</label>
                    <textarea
                      value={draft.competingInterests}
                      onChange={(e) => setDraft((p) => ({ ...p, competingInterests: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[84px] focus:outline-none focus:border-emerald-500"
                      placeholder="Write “None” if none."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500">FUNDING (required)</label>
                    <textarea
                      value={draft.funding}
                      onChange={(e) => setDraft((p) => ({ ...p, funding: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[84px] focus:outline-none focus:border-emerald-500"
                      placeholder="Write “None” if none."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500">FALSIFIABILITY_PATH (required)</label>
                  <textarea
                    value={draft.falsifiabilityPath}
                    onChange={(e) => setDraft((p) => ({ ...p, falsifiabilityPath: e.target.value }))}
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                    placeholder="At least 1 test path: real experiment / simulation prediction / formal counterexample search."
                  />
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={draft.falsifiabilityCurrentlyUntestable}
                      onChange={(e) => setDraft((p) => ({ ...p, falsifiabilityCurrentlyUntestable: e.target.checked }))}
                    />
                    CURRENTLY_UNTESTABLE (requires dependencies + future trigger)
                  </label>
                  <div className="text-xs text-zinc-600">
                    If the falsifiability path is currently untestable, state the dependency conditions and what future trigger would make it testable.
                  </div>
                  <div className="text-xs text-zinc-600">
                    Motivation: a falsifiability path is not meant to reject bold theories—it turns a theory from belief into a research plan. / 动机解释：可证伪路径不是为了否定大胆理论，而是为了让理论从信仰变成研究计划。
                  </div>

                  {draft.falsifiabilityCurrentlyUntestable || seemsCurrentlyUntestable(draft.falsifiabilityPath) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-mono text-zinc-500">DEPENDENCY_CONDITIONS (required)</label>
                        <textarea
                          value={draft.falsifiabilityDependencies}
                          onChange={(e) => setDraft((p) => ({ ...p, falsifiabilityDependencies: e.target.value }))}
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[84px] focus:outline-none focus:border-emerald-500"
                          placeholder="What must become available (data, instruments, compute, proofs, community replication) before this can be tested?"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-mono text-zinc-500">FUTURE_TEST_TRIGGER (required)</label>
                        <textarea
                          value={draft.falsifiabilityTrigger}
                          onChange={(e) => setDraft((p) => ({ ...p, falsifiabilityTrigger: e.target.value }))}
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[84px] focus:outline-none focus:border-emerald-500"
                          placeholder="What concrete event/threshold would trigger a test? (e.g., new dataset release, telescope sensitivity, theorem proved, simulation scale reached)"
                        />
                      </div>
                    </div>
                  ) : null}
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
                <CardTitle className="text-zinc-100">Relation to Prior Work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-400">At least 5 references, each with inheritance/conflict/difference notes.</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700" onClick={addPriorWork}>
                      + Add Reference
                    </Button>
                    {priorWork.length === 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-400 hover:text-white"
                        onClick={() => {
                          setPriorWork(Array.from({ length: 5 }, () => ({ citation: "", inherits: "", conflicts: "", differs: "" })));
                        }}
                      >
                        + Add 5
                      </Button>
                    ) : null}
                  </div>
                </div>

                {priorWorkGate.issues.length ? (
                  <div className="border border-red-900/40 bg-red-950/20 p-3 space-y-2">
                    <div className="text-xs font-mono text-red-300">PRIOR_WORK_BLOCKED</div>
                    <div className="text-xs text-zinc-500">
                      References: {priorWorkGate.total} | Complete: {priorWorkGate.complete}/{priorWorkGate.total} | Min required: 5
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-200">
                      {priorWorkGate.issues.map((it) => (
                        <li key={it.id}>
                          {it.en} / {it.zh}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-1">
                    <div className="text-xs font-mono text-emerald-400">PRIOR_WORK_OK</div>
                    <div className="text-xs text-zinc-500">
                      References: {priorWorkGate.total} | Complete: {priorWorkGate.complete}/{priorWorkGate.total}
                    </div>
                  </div>
                )}

                <div className="text-xs text-zinc-600">
                  Motivation: citations are not decoration. They prove you are not inventing in a vacuum and help readers place your work on the map. / 动机解释：外行可能觉得引用是装饰；学术上引用是对你不是凭空发明的最基本证明，也是让读者定位你在地图上的位置。
                </div>

                {priorWork.length ? (
                  <div className="space-y-3">
                    {priorWork.map((w, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-mono text-zinc-600">REFERENCE R{idx + 1}</div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white" onClick={() => removePriorWork(idx)}>
                            Remove
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-mono text-zinc-500">CITATION (required)</label>
                          <Input
                            value={w.citation}
                            onChange={(e) => updatePriorWork(idx, { citation: e.target.value })}
                            placeholder="e.g. Author (Year) Title / DOI / arXiv:xxxx.xxxxx"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">INHERITS (required)</label>
                            <textarea
                              value={w.inherits}
                              onChange={(e) => updatePriorWork(idx, { inherits: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[72px] focus:outline-none focus:border-emerald-500"
                              placeholder="What do you adopt/build on from this work?"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">CONFLICTS (required)</label>
                            <textarea
                              value={w.conflicts}
                              onChange={(e) => updatePriorWork(idx, { conflicts: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[72px] focus:outline-none focus:border-emerald-500"
                              placeholder="Where do you disagree or where does your claim conflict?"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">DIFFERS (required)</label>
                            <textarea
                              value={w.differs}
                              onChange={(e) => updatePriorWork(idx, { differs: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[72px] focus:outline-none focus:border-emerald-500"
                              placeholder="What is the key difference/novelty vs. this work?"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">中文提示</label>
                            <div className="text-xs text-zinc-600 leading-relaxed">
                              继承点：你继承/借用什么；冲突点：你否定/修正什么；差异点：你新增什么。
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 italic">
                    No references yet. Add at least 5 related works and explain inheritance/conflict/difference for each.
                  </div>
                )}
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

                {claimsGate.issues.length ? (
                  <div className="border border-red-900/40 bg-red-950/20 p-3 space-y-2">
                    <div className="text-xs font-mono text-red-300">CLAIMS_LIST_BLOCKED</div>
                    <div className="text-xs text-zinc-500">
                      Claims: {claimsGate.total} • With source refs: {claimsGate.withSourceRef}/{claimsGate.total}
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-200">
                      {claimsGate.issues.map((it) => (
                        <li key={it.id}>
                          {it.en} / {it.zh}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-1">
                    <div className="text-xs font-mono text-emerald-400">CLAIMS_LIST_OK</div>
                    <div className="text-xs text-zinc-500">
                      Claims: {claimsGate.total} • With source refs: {claimsGate.withSourceRef}/{claimsGate.total}
                    </div>
                  </div>
                )}

                {claimEvidence.length ? (
                  <div className="space-y-3">
                    {claimEvidence.map((c, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-mono text-zinc-600">CLAIM C{idx + 1}</div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">SOURCE_REF (required)</label>
                            <Input
                              value={c.sourceRef || ""}
                              onChange={(e) => updateClaimSourceRef(idx, e.target.value)}
                              placeholder="e.g. §2 ¶3 / Prop. 4 / Theorem 1"
                            />
                            <div className="text-xs text-zinc-600">Point to a concrete paragraph / proposition / theorem id for auditability.</div>
                          </div>
                        </div>
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
                  <div className="text-sm text-zinc-600 italic">
                    No claims yet. Add 3–7 core claims (C1...) and include a SOURCE_REF (paragraph / proposition / theorem id) for each.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100">Assumption Ledger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-400">
                    Assumptions:{" "}
                    <span className="font-mono text-emerald-500">
                      {assumptionGate.total}
                    </span>{" "}
                    | Complete:{" "}
                    <span className="font-mono text-emerald-500">
                      {assumptionGate.complete}/{assumptionGate.total}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="border-zinc-700" onClick={addAssumption}>
                    + Add Assumption
                  </Button>
                </div>

                {assumptionGate.issues.length ? (
                  <div className="border border-red-900/40 bg-red-950/20 p-3 space-y-2">
                    <div className="text-xs font-mono text-red-300">ASSUMPTION_LEDGER_BLOCKED</div>
                    <div className="text-xs text-zinc-500">
                      Assumptions: {assumptionGate.total} | Complete: {assumptionGate.complete}/{assumptionGate.total}
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-200">
                      {assumptionGate.issues.map((it) => (
                        <li key={it.id}>
                          {it.en} / {it.zh}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                    <div className="border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-1">
                      <div className="text-xs font-mono text-emerald-400">ASSUMPTION_LEDGER_OK</div>
                      <div className="text-xs text-zinc-500">
                      Assumptions: {assumptionGate.total} | Complete: {assumptionGate.complete}/{assumptionGate.total}
                      </div>
                    </div>
                  )}

                {assumptionLedger.length ? (
                  <div className="space-y-3">
                    {assumptionLedger.map((a, idx) => (
                      <div key={idx} className="border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-mono text-zinc-600">ASSUMPTION A{idx + 1}</div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white" onClick={() => removeAssumption(idx)}>
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-mono text-zinc-500">ASSUMPTION (required)</label>
                            <textarea
                              value={a.assumption}
                              onChange={(e) => updateAssumption(idx, { assumption: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                              placeholder="State the assumption explicitly (avoid hiding it in prose)."
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">WHY_NEEDED (required)</label>
                            <textarea
                              value={a.whyNeeded}
                              onChange={(e) => updateAssumption(idx, { whyNeeded: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                              placeholder="Why is this assumption needed for the derivation/claim?"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">WHAT_WOULD_FALSIFY_IT (required)</label>
                            <textarea
                              value={a.falsify}
                              onChange={(e) => updateAssumption(idx, { falsify: e.target.value })}
                              className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[64px] focus:outline-none focus:border-emerald-500"
                              placeholder="What observation/counterexample would break this assumption?"
                            />
                          </div>
                        </div>

                        <div className="text-xs text-zinc-600">
                          Motivation: disagreements often live in hidden assumptions. Make them explicit so review can converge.
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 italic">
                    No assumptions yet. Add 3-8 core assumptions and how each could be falsified.
                  </div>
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
                  <Button
                    variant="emerald"
                    onClick={() => void runInitialReview()}
                    disabled={
                      runStatus === "running" ||
                      submissionGate.issues.length > 0 ||
                      claimsGate.issues.length > 0 ||
                      assumptionGate.issues.length > 0 ||
                      priorWorkGate.issues.length > 0
                    }
                  >
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
