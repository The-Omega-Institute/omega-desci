"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { Badge, Card, CardContent, CardHeader, CardTitle, Separator } from "@/components/ui/shadcn";

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

type DoiCheckResult = {
  doi: string;
  exists: boolean | null;
  status: number | null;
  title?: string;
  checkedAt: string;
  error?: string;
};

type AuditVerdict = "pass" | "needs_evidence" | "fail" | "na";

const verdictBadge: Record<AuditVerdict, { label: string; variant: "emerald" | "amber" | "destructive" | "muted" }> = {
  pass: { label: "PASS", variant: "emerald" },
  needs_evidence: { label: "NEEDS_EVIDENCE", variant: "amber" },
  fail: { label: "FAIL", variant: "destructive" },
  na: { label: "N/A", variant: "muted" },
};

function chip(v: AuditVerdict) {
  const meta = verdictBadge[v];
  return (
    <Badge variant={meta.variant} className="font-mono text-[10px] px-2 py-0.5">
      {meta.label}
    </Badge>
  );
}

function isFilled(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isClaimId(id: unknown) {
  return typeof id === "string" && /^C\d+$/i.test(id.trim());
}

type AuditRow = {
  id: string;
  labelEn: string;
  labelZh: string;
  verdict: AuditVerdict;
  detailEn: string;
  detailZh: string;
  fixEn: string;
  fixZh: string;
};

function rollupVerdict(rows: { verdict: AuditVerdict }[]): AuditVerdict {
  if (rows.some((r) => r.verdict === "fail")) return "fail";
  if (rows.some((r) => r.verdict === "needs_evidence")) return "needs_evidence";
  if (rows.some((r) => r.verdict === "pass")) return "pass";
  return "na";
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function splitSentences(text: string) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/(?<=[.!?。！？])\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function normalizeDoi(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const withoutPrefix = raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
  return withoutPrefix.replace(/[)\].,;]+$/g, "").trim();
}

function extractDoisFromText(text: string) {
  const out = new Set<string>();
  const hay = String(text || "");
  const re = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay))) {
    const doi = normalizeDoi(m[0]);
    if (doi) out.add(doi.toLowerCase());
  }
  return Array.from(out);
}

function tokenizeForMatch(text: string) {
  const t = String(text || "").toLowerCase();
  const words = t.match(/[a-z0-9][a-z0-9_-]{1,}/g) || [];
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "these",
    "those",
    "into",
    "over",
    "under",
    "via",
    "using",
    "use",
    "used",
    "we",
    "our",
    "their",
    "is",
    "are",
    "was",
    "were",
    "be",
    "to",
    "of",
    "in",
    "on",
    "as",
    "by",
    "an",
    "a",
  ]);
  return new Set(words.filter((w) => w.length >= 3 && !stop.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const k of a) if (b.has(k)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function snippet(text: string, max = 110) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function AuditReportPanel({
  paper,
  evidencePointers,
  claimEvidence,
  assumptionLedger,
  priorWork,
}: {
  paper: Paper;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
  assumptionLedger?: AssumptionLedgerEntry[];
  priorWork?: PriorWorkEntry[];
}) {
  const generatedAt = useState(() => new Date().toISOString())[0];

  const doiCandidates = useMemo(() => {
    const out = new Set<string>();
    for (const doi of extractDoisFromText(paper.doi || "")) out.add(doi);
    for (const doi of extractDoisFromText(paper.abstract || "")) out.add(doi);

    for (const w of normalizeArray<PriorWorkEntry>(priorWork)) {
      for (const doi of extractDoisFromText(w.citation || "")) out.add(doi);
    }

    for (const p of normalizeArray<EvidencePointer>(evidencePointers)) {
      if (p?.doi) {
        const normalized = normalizeDoi(p.doi).toLowerCase();
        if (normalized.startsWith("10.")) out.add(normalized);
      }
      if (p?.url) for (const doi of extractDoisFromText(p.url)) out.add(doi);
      if (p?.ref) for (const doi of extractDoisFromText(p.ref)) out.add(doi);
    }

    return Array.from(out)
      .filter((d) => /^10\.\d{4,9}\//.test(d))
      .slice(0, 8);
  }, [evidencePointers, paper.abstract, paper.doi, priorWork]);

  const [doiChecks, setDoiChecks] = useState<Record<string, DoiCheckResult>>({});

  useEffect(() => {
    let cancelled = false;
    setDoiChecks({});
    if (doiCandidates.length === 0) return () => void 0;

    async function run() {
      for (const doi of doiCandidates.slice(0, 6)) {
        const checkedAt = new Date().toISOString();
        try {
          const res = await fetch(`/api/review/citation/doi?doi=${encodeURIComponent(doi)}`, { cache: "no-store" });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { doi?: string; exists?: boolean | null; status?: number | null; title?: string };
          if (cancelled) return;
          setDoiChecks((prev) => ({
            ...prev,
            [doi]: {
              doi,
              exists: typeof data.exists === "boolean" ? data.exists : null,
              status: typeof data.status === "number" ? data.status : null,
              title: typeof data.title === "string" ? data.title : undefined,
              checkedAt,
            },
          }));
        } catch (err) {
          if (cancelled) return;
          setDoiChecks((prev) => ({
            ...prev,
            [doi]: {
              doi,
              exists: null,
              status: null,
              checkedAt,
              error: err instanceof Error ? err.message : "DOI check unavailable.",
            },
          }));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [doiCandidates]);

  const report = useMemo(() => {
    const claims = normalizeArray<ClaimEvidence>(claimEvidence).filter((c) => isFilled(c.claim));
    const assumptions = normalizeArray<AssumptionLedgerEntry>(assumptionLedger).filter((a) => isFilled(a.assumption));
    const prior = normalizeArray<PriorWorkEntry>(priorWork).filter((w) => isFilled(w.citation));

    const claimsMissingId = claims.filter((c) => !isClaimId(c.id)).length;
    const claimsMissingSource = claims.filter((c) => !isFilled(c.sourceRef)).length;

    const claimsVerdict: AuditVerdict =
      claims.length === 0 ? "fail" : claimsMissingId > 0 || claimsMissingSource > 0 ? "needs_evidence" : "pass";

    const assumptionsMissingFields = assumptions.filter((a) => !isFilled(a.whyNeeded) || !isFilled(a.falsify)).length;
    const assumptionsVerdict: AuditVerdict = assumptions.length === 0 ? "fail" : assumptionsMissingFields > 0 ? "needs_evidence" : "pass";

    const falsifiability = (paper.falsifiabilityPath || "").trim();
    const falsifiabilityVerdict: AuditVerdict =
      !falsifiability || falsifiability.toLowerCase() === "n/a" ? "fail" : falsifiability.length < 30 ? "needs_evidence" : "pass";

    const priorMissingFields = prior.filter((w) => !isFilled(w.inherits) || !isFilled(w.conflicts) || !isFilled(w.differs)).length;
    const relatedVerdict: AuditVerdict = prior.length === 0 ? "fail" : prior.length < 5 || priorMissingFields > 0 ? "needs_evidence" : "pass";

    const provenanceOk = isFilled(paper.provenanceStatement);
    const coiOk = isFilled(paper.competingInterests);
    const fundingOk = isFilled(paper.funding);
    const disclosuresVerdict: AuditVerdict = provenanceOk && coiOk && fundingOk ? "pass" : provenanceOk ? "needs_evidence" : "fail";

    const completenessRows: AuditRow[] = [
      {
        id: "claims",
        labelEn: "Claims",
        labelZh: "主张（Claims）",
        verdict: claimsVerdict,
        detailEn:
          claims.length === 0
            ? "Missing numbered claims list."
            : `Claims: ${claims.length}. Missing ids: ${claimsMissingId}. Missing SOURCE_REF: ${claimsMissingSource}.`,
        detailZh:
          claims.length === 0
            ? "缺少可编号主张清单。"
            : `主张数：${claims.length}。缺少编号：${claimsMissingId}。缺少 SOURCE_REF：${claimsMissingSource}。`,
        fixEn: "Add 3–7 core claims (C1..Cn). Each claim should include a SOURCE_REF (paragraph / proposition / theorem id).",
        fixZh: "补齐 3–7 条核心主张（C1..Cn），并为每条主张填写 SOURCE_REF（段落/命题/定理编号）。",
      },
      {
        id: "assumptions",
        labelEn: "Assumptions",
        labelZh: "假设（Assumptions）",
        verdict: assumptionsVerdict,
        detailEn:
          assumptions.length === 0
            ? "Missing assumption ledger."
            : `Assumptions: ${assumptions.length}. Missing “Why needed” or “What would falsify it”: ${assumptionsMissingFields}.`,
        detailZh:
          assumptions.length === 0
            ? "缺少假设清单（Assumption Ledger）。"
            : `假设数：${assumptions.length}。缺少“Why needed/What would falsify it”：${assumptionsMissingFields}。`,
        fixEn: "Add 3–8 core assumptions. For each: what it is, why it’s needed, and what would falsify it.",
        fixZh: "补齐 3–8 条核心假设；每条需包含：假设内容、为何需要、如何被证伪。",
      },
      {
        id: "falsifiability",
        labelEn: "Falsifiability path",
        labelZh: "可证伪路径（Falsifiability Path）",
        verdict: falsifiabilityVerdict,
        detailEn:
          falsifiabilityVerdict === "fail"
            ? "Missing falsifiability path."
            : falsifiabilityVerdict === "needs_evidence"
              ? "Falsifiability path is present but too vague; add thresholds and negative controls."
              : "Falsifiability path provided.",
        detailZh:
          falsifiabilityVerdict === "fail"
            ? "缺少可证伪路径。"
            : falsifiabilityVerdict === "needs_evidence"
              ? "可证伪路径存在但过于模糊；请补充阈值与反例/负对照。"
              : "已提供可证伪路径。",
        fixEn: "Write at least one test path with concrete thresholds; if currently untestable, state dependencies and the future trigger explicitly.",
        fixZh: "至少写出 1 条带阈值的可检验路径；若暂不可检验，需明确依赖条件与未来触发点。",
      },
      {
        id: "related_work",
        labelEn: "Related work",
        labelZh: "相关工作（Related Work）",
        verdict: relatedVerdict,
        detailEn:
          prior.length === 0
            ? "Missing relation to prior work."
            : `References: ${prior.length}. Missing inherits/conflicts/differs notes: ${priorMissingFields}.`,
        detailZh:
          prior.length === 0
            ? "缺少相关工作与对齐说明。"
            : `参考文献：${prior.length}。缺少继承/冲突/差异说明：${priorMissingFields}。`,
        fixEn: "Provide at least 5 references. For each: inheritance, conflict, and difference notes.",
        fixZh: "至少补齐 5 条相关工作；每条写明继承点/冲突点/差异点。",
      },
      {
        id: "disclosures",
        labelEn: "Disclosure statements",
        labelZh: "披露声明（Disclosures）",
        verdict: disclosuresVerdict,
        detailEn: `Provenance/tooling: ${provenanceOk ? "ok" : "missing"}. COI: ${coiOk ? "ok" : "missing"}. Funding: ${fundingOk ? "ok" : "missing"}.`,
        detailZh: `Provenance/tooling：${provenanceOk ? "ok" : "缺失"}。COI：${coiOk ? "ok" : "缺失"}。Funding：${fundingOk ? "ok" : "缺失"}。`,
        fixEn: "Fill provenance/tooling statement plus COI and funding (“None” is acceptable) so the record is re-auditable.",
        fixZh: "补齐 provenance/tooling 声明 + COI 与 funding（可写 None），确保记录可复核。",
      },
    ];

    const module1Verdict = rollupVerdict(completenessRows);
    const pointers = normalizeArray<EvidencePointer>(evidencePointers);
    const pointerById = new Map<string, EvidencePointer>();
    for (const p of pointers) {
      const id = typeof p?.id === "string" ? p.id.trim() : "";
      if (id) pointerById.set(id, p);
    }

    const referencedEvidenceIds = new Set<string>();
    for (const c of claims) {
      const ids = Array.isArray(c.evidenceIds) ? c.evidenceIds : [];
      for (const id of ids) {
        const clean = typeof id === "string" ? id.trim() : "";
        if (clean) referencedEvidenceIds.add(clean);
      }
    }

    // Module 2: Claim Extraction and Traceability
    const abstractCandidates = claims.length === 0 ? splitSentences(paper.abstract || "").slice(0, 3) : [];
    const claimsWithSource = claims.filter((c) => isFilled(c.sourceRef)).length;
    const claimsWithEvidence = claims.filter((c) => Array.isArray(c.evidenceIds) && c.evidenceIds.length > 0).length;
    const unresolvedEvidenceLinks = claims.reduce((acc, c) => {
      const ids = Array.isArray(c.evidenceIds) ? c.evidenceIds : [];
      return acc + ids.filter((id) => !pointerById.has(String(id))).length;
    }, 0);
    const orphanPointers = pointers.filter((p) => p?.id && !referencedEvidenceIds.has(p.id)).length;

    const module2Rows: AuditRow[] = [
      {
        id: "m2.claims",
        labelEn: "Claim extraction (C1..Cn)",
        labelZh: "主张抽取（C1..Cn）",
        verdict: claims.length > 0 ? (claimsMissingId > 0 ? "needs_evidence" : "pass") : "needs_evidence",
        detailEn:
          claims.length > 0
            ? `Structured claims provided: ${claims.length}. Missing claim ids: ${claimsMissingId}.`
            : abstractCandidates.length
              ? `No structured claims provided. Heuristic candidates (from abstract): ${abstractCandidates.map((s) => `"${snippet(s)}"`).join(" / ")}.`
              : "No structured claims provided and abstract is empty.",
        detailZh:
          claims.length > 0
            ? `已提供结构化主张：${claims.length}。缺少主张编号：${claimsMissingId}。`
            : abstractCandidates.length
              ? `未提供结构化主张。启发式候选主张（来自摘要）：${abstractCandidates.map((s) => `“${snippet(s)}”`).join(" / ")}。`
              : "未提供结构化主张，且摘要为空。",
        fixEn: "Add 3–7 numbered claims (C1..Cn). Keep each claim falsifiable and scoped.",
        fixZh: "补齐 3–7 条编号主张（C1..Cn）；每条主张保持可证伪且边界清晰。",
      },
      {
        id: "m2.traceability",
        labelEn: "Traceability (SOURCE_REF + evidence ids)",
        labelZh: "可追溯性（SOURCE_REF + 证据 id）",
        verdict:
          claims.length === 0
            ? "needs_evidence"
            : claimsWithSource < claims.length || claimsWithEvidence < claims.length || unresolvedEvidenceLinks > 0
              ? "needs_evidence"
              : "pass",
        detailEn:
          claims.length === 0
            ? "Traceability requires a structured claims list."
            : `Claims with SOURCE_REF: ${claimsWithSource}/${claims.length}. Claims with evidence ids: ${claimsWithEvidence}/${claims.length}. Unresolved evidence links: ${unresolvedEvidenceLinks}.`,
        detailZh:
          claims.length === 0
            ? "可追溯性检查需要先提供结构化主张清单。"
            : `含 SOURCE_REF 的主张：${claimsWithSource}/${claims.length}。含证据 id 的主张：${claimsWithEvidence}/${claims.length}。无法解析的证据链接：${unresolvedEvidenceLinks}。`,
        fixEn: "For each claim, add a SOURCE_REF (paragraph/theorem id) and link 1–3 evidence pointers (fig/table/data/code/DOI/hash).",
        fixZh: "每条主张填写 SOURCE_REF（段落/定理编号），并链接 1–3 个证据指针（图表/数据/代码/DOI/哈希）。",
      },
      {
        id: "m2.orphans",
        labelEn: "Unmapped evidence pointers",
        labelZh: "未映射的证据指针",
        verdict: pointers.length === 0 ? "na" : orphanPointers > 0 ? "needs_evidence" : "pass",
        detailEn: pointers.length === 0 ? "No evidence pointers provided." : `Evidence pointers: ${pointers.length}. Unmapped: ${orphanPointers}.`,
        detailZh: pointers.length === 0 ? "未提供证据指针。" : `证据指针：${pointers.length}。未被主张引用：${orphanPointers}。`,
        fixEn: "If a pointer matters to any conclusion, attach it to a numbered claim; otherwise remove it to keep the record clean.",
        fixZh: "若该指针支撑任何结论，请挂到对应编号主张；否则建议移除，保持记录干净。",
      },
    ];
    const module2Verdict = rollupVerdict(module2Rows);

    // Module 3: Assumption Consistency (hidden assumptions)
    const assumptionText = `${paper.title}\n${paper.abstract || ""}\n${claims.map((c) => c.claim).join("\n")}`;
    const assumptionCue =
      /(we\s+assume|assume\s+that|assuming\b|suppose|without\s+loss\s+of\s+generality|\bwlog\b|we\s+restrict|we\s+consider|under\s+the\s+assumption|provided\s+that|let\s+\w+\s+be|假设|不失一般性|设)/i;
    const assumptionCandidates = splitSentences(assumptionText).filter((s) => assumptionCue.test(s)).slice(0, 8);
    const ledgerTokens = assumptions.map((a) => tokenizeForMatch(a.assumption));
    const uncoveredCandidates = assumptionCandidates
      .filter((cand) => {
        const tokens = tokenizeForMatch(cand);
        let best = 0;
        for (const lt of ledgerTokens) best = Math.max(best, jaccard(tokens, lt));
        return best < 0.25 && tokens.size >= 3;
      })
      .slice(0, 4);

    const module3Rows: AuditRow[] = [
      {
        id: "m3.ledger",
        labelEn: "Assumption Ledger coverage",
        labelZh: "假设账本覆盖度",
        verdict: assumptions.length === 0 ? "needs_evidence" : "pass",
        detailEn: assumptions.length === 0 ? "Missing Assumption Ledger entries." : `Assumption Ledger entries: ${assumptions.length}.`,
        detailZh: assumptions.length === 0 ? "缺少 Assumption Ledger 条目。" : `Assumption Ledger 条目：${assumptions.length}。`,
        fixEn: "List the assumptions that your claims depend on, then add: why needed + what would falsify it.",
        fixZh: "补齐支撑主张所依赖的假设，并为每条写明：为何需要 + 如何被证伪。",
      },
      {
        id: "m3.hidden",
        labelEn: "Hidden assumptions (heuristic)",
        labelZh: "隐含假设（启发式）",
        verdict: assumptionCandidates.length === 0 ? "na" : uncoveredCandidates.length > 0 ? "needs_evidence" : "pass",
        detailEn:
          assumptionCandidates.length === 0
            ? "No assumption cues detected in the record-level text."
            : uncoveredCandidates.length > 0
              ? `Potential hidden assumptions (not in ledger): ${uncoveredCandidates.map((s) => `"${snippet(s)}"`).join(" / ")}.`
              : "Assumption cues appear to be covered by the ledger.",
        detailZh:
          assumptionCandidates.length === 0
            ? "在记录级文本中未检测到明显的假设提示语。"
            : uncoveredCandidates.length > 0
              ? `可能的隐含假设（账本未覆盖）：${uncoveredCandidates.map((s) => `“${snippet(s)}”`).join(" / ")}。`
              : "假设提示语看起来已被假设账本覆盖。",
        fixEn: "Add any hidden assumptions into the Assumption Ledger and specify a falsification path for each.",
        fixZh: "将隐含假设补入 Assumption Ledger，并为每条写明可证伪路径。",
      },
    ];
    const module3Verdict = rollupVerdict(module3Rows);

    // Module 4: Citation Integrity (risk-only)
    const invalidDoiMentions = prior.filter((w) => /\bdoi\b/i.test(w.citation || "") && extractDoisFromText(w.citation || "").length === 0).length;
    const pointerInvalidDois = pointers.filter((p) => p.type === "doi" && p.doi && !/^10\.\d{4,9}\//.test(normalizeDoi(p.doi).toLowerCase())).length;

    const doiCounts = new Map<string, number>();
    for (const doi of extractDoisFromText(paper.doi || "")) doiCounts.set(doi, (doiCounts.get(doi) || 0) + 1);
    for (const w of prior) for (const doi of extractDoisFromText(w.citation || "")) doiCounts.set(doi, (doiCounts.get(doi) || 0) + 1);
    for (const p of pointers) {
      if (p?.doi) {
        const d = normalizeDoi(p.doi).toLowerCase();
        if (/^10\.\d{4,9}\//.test(d)) doiCounts.set(d, (doiCounts.get(d) || 0) + 1);
      }
      if (p?.url) for (const doi of extractDoisFromText(p.url)) doiCounts.set(doi, (doiCounts.get(doi) || 0) + 1);
    }

    const duplicateDois = Array.from(doiCounts.entries())
      .filter(([, n]) => n > 1)
      .map(([d]) => d);

    const checkedDois = doiCandidates.filter((d) => doiChecks[d]);
    const doiNotFound = checkedDois.filter((d) => doiChecks[d]?.exists === false).length;
    const doiCheckErrors = checkedDois.filter((d) => Boolean(doiChecks[d]?.error)).length;

    const module4Rows: AuditRow[] = [
      {
        id: "m4.doi_format",
        labelEn: "DOI format & extraction",
        labelZh: "DOI 格式与抽取",
        verdict: invalidDoiMentions > 0 || pointerInvalidDois > 0 ? "needs_evidence" : doiCounts.size > 0 ? "pass" : "na",
        detailEn:
          doiCounts.size === 0
            ? "No DOIs detected in the record-level fields."
            : `Detected DOIs: ${doiCounts.size}. Invalid “doi:” mentions: ${invalidDoiMentions}. Invalid DOI pointers: ${pointerInvalidDois}.`,
        detailZh:
          doiCounts.size === 0
            ? "在记录级字段中未检测到 DOI。"
            : `检测到 DOI：${doiCounts.size}。无效 “doi:” 提及：${invalidDoiMentions}。无效 DOI 指针：${pointerInvalidDois}。`,
        fixEn: "Ensure DOIs use the canonical format `10.xxxx/…` and prefer linking them as evidence pointers.",
        fixZh: "确保 DOI 使用规范格式 `10.xxxx/…`，并优先作为证据指针进行链接。",
      },
      {
        id: "m4.duplicates",
        labelEn: "Duplicate DOI signals",
        labelZh: "重复 DOI 信号",
        verdict: duplicateDois.length > 0 ? "needs_evidence" : doiCounts.size > 0 ? "pass" : "na",
        detailEn:
          duplicateDois.length > 0
            ? `Duplicate DOIs found: ${duplicateDois.slice(0, 3).join(", ")}${duplicateDois.length > 3 ? "…" : ""}.`
            : doiCounts.size > 0
              ? "No duplicate DOI signals detected."
              : "No DOI signals to evaluate.",
        detailZh:
          duplicateDois.length > 0
            ? `发现重复 DOI：${duplicateDois.slice(0, 3).join(", ")}${duplicateDois.length > 3 ? "…" : ""}。`
            : doiCounts.size > 0
              ? "未检测到重复 DOI 信号。"
              : "无 DOI 信号可评估。",
        fixEn: "If duplicates are intentional (same work cited multiple times), ensure each citation explains its role; otherwise dedupe.",
        fixZh: "若重复是有意为之（同一工作多处引用），请说明引用用途；否则建议去重。",
      },
      {
        id: "m4.existence",
        labelEn: "DOI existence check (best-effort)",
        labelZh: "DOI 存在性检查（尽力确认）",
        verdict: doiCandidates.length === 0 ? "na" : doiNotFound > 0 ? "needs_evidence" : checkedDois.length > 0 && doiCheckErrors === 0 ? "pass" : "na",
        detailEn:
          doiCandidates.length === 0
            ? "No DOI candidates to verify."
            : checkedDois.length === 0
              ? "Existence checks unavailable in this runtime (or still pending)."
              : `Checked: ${checkedDois.length}. Not found: ${doiNotFound}. Errors: ${doiCheckErrors}.`,
        detailZh:
          doiCandidates.length === 0
            ? "无 DOI 候选可验证。"
            : checkedDois.length === 0
              ? "当前运行环境无法进行存在性检查（或仍在进行中）。"
              : `已检查：${checkedDois.length}。未找到：${doiNotFound}。错误：${doiCheckErrors}。`,
        fixEn: "If a DOI cannot be resolved, verify it against the source (Zenodo/Publisher) and correct typos or versions.",
        fixZh: "若 DOI 无法解析，请回到来源（Zenodo/期刊）核对并修正拼写或版本。",
      },
    ];
    const module4Verdict = rollupVerdict(module4Rows);

    // Module 5: Symbol and Logic Heuristics (explicitly heuristic)
    const symbolDefs = new Map<string, string[]>();
    const re1 = /\b([A-Za-z])\b\s*(?:denotes|represents|is defined as|:=|=)\s*([^.;,]{3,60})/gi;
    let m1: RegExpExecArray | null;
    while ((m1 = re1.exec(assumptionText))) {
      const sym = m1[1].trim();
      const def = m1[2].trim();
      if (!sym || !def) continue;
      const list = symbolDefs.get(sym) || [];
      list.push(def);
      symbolDefs.set(sym, list);
    }
    const re2 = /\b(?:let|define)\s+([A-Za-z][A-Za-z0-9_]*)\s+(?:be|as)\s+([^.;]{3,80})/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(assumptionText))) {
      const sym = m2[1].trim();
      const def = m2[2].trim();
      if (!sym || !def) continue;
      const list = symbolDefs.get(sym) || [];
      list.push(def);
      symbolDefs.set(sym, list);
    }

    const inconsistentSymbols: Array<{ sym: string; a: string; b: string }> = [];
    for (const [sym, defs] of symbolDefs) {
      if (defs.length < 2) continue;
      const tokenSets = defs.map((d) => tokenizeForMatch(d));
      let best = 0;
      for (let i = 0; i < tokenSets.length; i++) {
        for (let j = i + 1; j < tokenSets.length; j++) best = Math.max(best, jaccard(tokenSets[i], tokenSets[j]));
      }
      if (best < 0.4) inconsistentSymbols.push({ sym, a: defs[0], b: defs[1] });
    }

    const jumpRe = /\b(clearly|obviously|straightforward|trivial(ly)?|it follows|hence|therefore|thus|we omit|omitted)\b/gi;
    const jumpCount = (assumptionText.match(jumpRe) || []).length;

    const module5Rows: AuditRow[] = [
      {
        id: "m5.symbols",
        labelEn: "Symbol definition consistency (heuristic)",
        labelZh: "符号定义一致性（启发式）",
        verdict: symbolDefs.size === 0 ? "na" : inconsistentSymbols.length > 0 ? "needs_evidence" : "pass",
        detailEn:
          symbolDefs.size === 0
            ? "No explicit symbol-definition patterns detected in record-level text."
            : inconsistentSymbols.length > 0
              ? `Potential redefinition/conflict: ${inconsistentSymbols.map((x) => `${x.sym}`).slice(0, 4).join(", ")}.`
              : `Detected symbol definitions: ${symbolDefs.size}. No obvious conflicts.`,
        detailZh:
          symbolDefs.size === 0
            ? "在记录级文本中未检测到明显的符号定义模式。"
            : inconsistentSymbols.length > 0
              ? `可能存在重定义/冲突：${inconsistentSymbols.map((x) => x.sym).slice(0, 4).join("、")}。`
              : `检测到符号定义：${symbolDefs.size}。未发现明显冲突。`,
        fixEn: "If a symbol is reused with different meanings, rename it or add a definition table/appendix anchor.",
        fixZh: "若符号在不同语境下含义不同，请更名或补充定义表/附录锚点。",
      },
      {
        id: "m5.jumps",
        labelEn: "Derivation-jump cues (heuristic)",
        labelZh: "推导跳步提示语（启发式）",
        verdict: jumpCount === 0 ? "pass" : "needs_evidence",
        detailEn: jumpCount === 0 ? "No “obvious/clearly” jump cues detected." : `Jump-cue hits: ${jumpCount} (e.g., “clearly”, “thus”).`,
        detailZh: jumpCount === 0 ? "未检测到明显的“显然/因此”等跳步提示语。" : `跳步提示语命中：${jumpCount}（如“clearly/thus”）。`,
        fixEn: "Where you use jump language, add a short intermediate step or link to a formal derivation artifact.",
        fixZh: "出现跳步提示语的位置，请补充中间步骤或链接到形式化推导产物。",
      },
    ];
    const module5Verdict = rollupVerdict(module5Rows);

    // Module 6: Reproducibility Readiness (checklist)
    const isComputational =
      paper.articleType === "Computational Experiment" ||
      paper.articleType === "Replication Report" ||
      paper.articleType === "Verification Report" ||
      Boolean(paper.codeAvailable || paper.dataAvailable) ||
      pointers.some((p) => p.type === "code" || p.type === "data");

    const codePointers = pointers.filter((p) => p.type === "code");
    const dataPointers = pointers.filter((p) => p.type === "data");
    const hasCodeAnchor = Boolean(paper.codeUrl) || codePointers.some((p) => Boolean(p.url || p.ref || p.doi));
    const hasCodePin = Boolean(paper.codeHash) || codePointers.some((p) => Boolean(p.hash || p.commit));
    const hasDataAnchor = Boolean(paper.dataUrl) || dataPointers.some((p) => Boolean(p.url || p.ref || p.doi || p.hash));

    const module6Rows: AuditRow[] = [
      {
        id: "m6.code",
        labelEn: "Code anchor + version pinning",
        labelZh: "代码锚点 + 版本锁定",
        verdict: !isComputational ? "na" : hasCodeAnchor && hasCodePin ? "pass" : hasCodeAnchor ? "needs_evidence" : "needs_evidence",
        detailEn: !isComputational ? "N/A (no computational artifact signals)." : `Code anchor: ${hasCodeAnchor ? "yes" : "no"}. Pin (commit/hash): ${hasCodePin ? "yes" : "no"}.`,
        detailZh: !isComputational ? "不适用（未检测到计算类产物信号）。" : `代码锚点：${hasCodeAnchor ? "有" : "无"}。版本锁定（commit/hash）：${hasCodePin ? "有" : "无"}。`,
        fixEn: "Provide a repo/snapshot link AND pin a commit/hash so reruns are deterministic.",
        fixZh: "提供仓库/快照链接，并锁定 commit/hash，确保复核可复现。",
      },
      {
        id: "m6.data",
        labelEn: "Data/input anchors",
        labelZh: "数据/输入锚点",
        verdict: !isComputational ? "na" : hasDataAnchor || !paper.dataAvailable ? "pass" : "needs_evidence",
        detailEn: !isComputational ? "N/A." : `Data available flag: ${paper.dataAvailable ? "yes" : "no"}. Data anchor: ${hasDataAnchor ? "yes" : "no"}.`,
        detailZh: !isComputational ? "不适用。" : `数据可用标记：${paper.dataAvailable ? "是" : "否"}。数据锚点：${hasDataAnchor ? "有" : "无"}。`,
        fixEn: "Link the exact dataset version (DOI/hash) and specify preprocessing steps.",
        fixZh: "链接到确切的数据版本（DOI/哈希），并写清预处理步骤。",
      },
      {
        id: "m6.runbook",
        labelEn: "Runbook: params + seeds + environment",
        labelZh: "运行说明：参数/seed/环境",
        verdict: !isComputational ? "na" : "needs_evidence",
        detailEn: !isComputational ? "N/A." : "Record-level metadata rarely includes a runbook; treat as missing unless explicitly provided.",
        detailZh: !isComputational ? "不适用。" : "记录级元数据通常不包含运行说明；除非明确提供，否则视为缺失。",
        fixEn: "Add a one-command run instruction, parameter table, seed policy, and environment spec (Docker/conda).",
        fixZh: "补充一键运行说明、参数表、seed 策略与环境规格（Docker/conda）。",
      },
    ];
    const module6Verdict = rollupVerdict(module6Rows);

    // Module 7: Paper-mill & Abuse Signals (human-review trigger only)
    const abs = String(paper.abstract || "").trim();
    const absSentences = splitSentences(abs);
    const normSents = absSentences.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim());
    const dupCount = normSents.length - new Set(normSents).size;
    const words = abs.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    const uniqueRatio = words.length ? new Set(words).size / words.length : 1;
    const bracketCites = (abs.match(/\[[0-9]+\]/g) || []).length;

    const suspiciousTemplate = dupCount > 0 || uniqueRatio < 0.35;

    const module7Rows: AuditRow[] = [
      {
        id: "m7.template",
        labelEn: "Template / repetition signals",
        labelZh: "模板化/重复信号",
        verdict: abs ? (suspiciousTemplate ? "needs_evidence" : "pass") : "na",
        detailEn: abs ? `Sentences: ${absSentences.length}. Duplicate sentences: ${dupCount}. Lexical diversity: ${(uniqueRatio * 100).toFixed(0)}%.` : "No abstract provided.",
        detailZh: abs ? `句子数：${absSentences.length}。重复句：${dupCount}。词汇多样性：${(uniqueRatio * 100).toFixed(0)}%。` : "未提供摘要。",
        fixEn: "If text is templated or repetitive, provide concrete claims, evidence links, and scoped definitions to reduce paper-mill ambiguity.",
        fixZh: "若文本模板化/重复，请补充具体主张、证据链接与范围定义，降低“论文工厂”式歧义。",
      },
      {
        id: "m7.citations",
        labelEn: "Abnormal citation density (heuristic)",
        labelZh: "异常引用密度（启发式）",
        verdict: bracketCites > 8 ? "needs_evidence" : abs ? "pass" : "na",
        detailEn: abs ? `Bracket-style citations in abstract: ${bracketCites}.` : "No abstract to evaluate.",
        detailZh: abs ? `摘要中的 [n] 引用次数：${bracketCites}。` : "无摘要可评估。",
        fixEn: "Move dense citations to the related-work section and ensure each citation supports a specific claim.",
        fixZh: "将密集引用移至相关工作，并确保每条引用服务于明确主张。",
      },
      {
        id: "m7.behavior",
        labelEn: "Submission-behavior telemetry",
        labelZh: "投稿行为信号",
        verdict: "na",
        detailEn: "N/A in this demo (no behavioral telemetry without a production backend).",
        detailZh: "Demo 版不适用（无生产后端，因此没有行为遥测）。",
        fixEn: "In production, use these signals only to trigger manual review—never for auto-rejection.",
        fixZh: "生产环境中仅用于触发人工复核，绝不用于自动拒稿。",
      },
    ];
    const module7Verdict = rollupVerdict(module7Rows);

    return {
      generatedAt,
      module1: {
        verdict: module1Verdict,
        rows: completenessRows,
      },
      module2: { verdict: module2Verdict, rows: module2Rows },
      module3: { verdict: module3Verdict, rows: module3Rows },
      module4: { verdict: module4Verdict, rows: module4Rows },
      module5: { verdict: module5Verdict, rows: module5Rows },
      module6: { verdict: module6Verdict, rows: module6Rows },
      module7: { verdict: module7Verdict, rows: module7Rows },
      meta: {
        evidencePointers: pointers.length,
        doiCandidates: doiCandidates.length,
      },
    };
  }, [assumptionLedger, claimEvidence, doiCandidates, doiChecks, evidencePointers, generatedAt, paper, priorWork]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-zinc-600">AI_AUDIT_REPORT</div>
              <CardTitle className="text-zinc-100">Seven-module audit report (AI Audit Line)</CardTitle>
              <div className="text-xs text-zinc-500">
                AI is not the judge. This report flags missing structure and produces re-checkable signals. / AI 不是裁判；该报告用于结构体检与可复核信号。
              </div>
            </div>
            <div className="text-xs font-mono text-zinc-600 text-right">
              <div>GENERATED_AT</div>
              <div className="text-zinc-400 break-all">{report.generatedAt}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-zinc-600">MODULE_1_OF_7</div>
              <Badge variant="muted" className="font-mono text-[10px]">
                COMPLETENESS_CHECK
              </Badge>
            </div>
            {chip(report.module1.verdict)}
          </div>

          <Separator className="bg-zinc-800" />

          <div className="space-y-3">
            {report.module1.rows.map((row) => (
              <div key={row.id} className="border border-zinc-800 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-zinc-200">{row.labelEn}</div>
                    <div className="text-xs text-zinc-500">{row.labelZh}</div>
                  </div>
                  {chip(row.verdict)}
                </div>
                <div className="mt-2 text-xs text-zinc-400">{row.detailEn}</div>
                <div className="mt-1 text-xs text-zinc-600">{row.detailZh}</div>
                <div className="mt-2 text-xs text-zinc-400">Fix: {row.fixEn}</div>
                <div className="mt-1 text-xs text-zinc-600">修复建议：{row.fixZh}</div>
              </div>
            ))}
          </div>

          <Separator className="bg-zinc-800" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                module: report.module2,
                code: "MODULE_2_OF_7",
                badge: "CLAIM_TRACEABILITY",
                titleEn: "Claim Extraction & Traceability",
                titleZh: "主张抽取与可追溯性",
                noteEn: "Risk signals only: checks C1..Cn, SOURCE_REF, and evidence-pointer linkage.",
                noteZh: "仅风险信号：检查 C1..Cn、SOURCE_REF 与证据指针挂钩情况。",
              },
              {
                module: report.module3,
                code: "MODULE_3_OF_7",
                badge: "ASSUMPTION_CONSISTENCY",
                titleEn: "Assumption Consistency",
                titleZh: "假设一致性",
                noteEn: "Flags likely hidden assumptions missing from the ledger (heuristic).",
                noteZh: "提示可能的隐含假设（启发式），用于补全假设账本。",
              },
              {
                module: report.module4,
                code: "MODULE_4_OF_7",
                badge: "CITATION_INTEGRITY",
                titleEn: "Citation Integrity",
                titleZh: "引用完整性",
                noteEn: "Format/DOI checks + best-effort existence signals; never an acceptance verdict.",
                noteZh: "格式/DOI 检查 + 尽力存在性信号；不作为接收/拒稿裁决。",
              },
              {
                module: report.module5,
                code: "MODULE_5_OF_7",
                badge: "SYMBOL_LOGIC_HEURISTICS",
                titleEn: "Symbol & Logic Heuristics",
                titleZh: "符号与逻辑启发式体检",
                noteEn: "Explicitly heuristic; does not claim to be a proof checker.",
                noteZh: "明确启发式；不伪装为证明检查器。",
              },
              {
                module: report.module6,
                code: "MODULE_6_OF_7",
                badge: "REPRO_READINESS",
                titleEn: "Reproducibility Readiness",
                titleZh: "复现就绪度",
                noteEn: "Actionable checklist: version pins, params/seeds, and runbook anchors.",
                noteZh: "可执行 checklist：版本锁定、参数/seed、运行说明锚点。",
              },
              {
                module: report.module7,
                code: "MODULE_7_OF_7",
                badge: "ABUSE_SIGNALS",
                titleEn: "Paper-mill & Abuse Signals",
                titleZh: "版式化与滥用信号",
                noteEn: "Human-review trigger only (never auto-reject).",
                noteZh: "仅触发人工复核（不会自动拒稿）。",
              },
            ].map((m) => (
              <div key={m.code} className="border border-zinc-800 bg-black/20 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-zinc-600">{m.code}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" className="font-mono text-[10px]">
                        {m.badge}
                      </Badge>
                      <div className="text-sm text-zinc-200">
                        {m.titleEn} <span className="text-xs text-zinc-500">/ {m.titleZh}</span>
                      </div>
                    </div>
                  </div>
                  {chip(m.module.verdict)}
                </div>

                <div className="text-xs text-zinc-600">{m.noteEn}</div>
                <div className="text-xs text-zinc-700">{m.noteZh}</div>

                <div className="space-y-2">
                  {m.module.rows.map((row) => (
                    <div key={row.id} className="border border-zinc-800 bg-black/30 p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs text-zinc-300">{row.labelEn}</div>
                          <div className="text-[11px] text-zinc-600">{row.labelZh}</div>
                        </div>
                        {chip(row.verdict)}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-500">{row.detailEn}</div>
                      <div className="mt-1 text-[11px] text-zinc-700">{row.detailZh}</div>
                      <div className="mt-2 text-[11px] text-zinc-500">Fix: {row.fixEn}</div>
                      <div className="mt-1 text-[11px] text-zinc-700">修复建议：{row.fixZh}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
