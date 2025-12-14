"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui/shadcn";
import { ChevronRight, Download, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PolicyDoc = {
  id: string;
  title: string;
  version: string;
  updated: string;
  content: JSX.Element;
};

const policies: PolicyDoc[] = [
  {
    id: "scope",
    title: "Scope and Article Types / 范围与文章类型",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> Omega Institute is an open archive and open review platform for theoretical research and computational foundational research. We accept bold
          exploration, but we require explicit structure so disputes can converge.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>Omega Institute 面向理论型研究与计算型基础研究。平台鼓励高方差探索，但必须以结构化字段保证可讨论、可收敛、可复核。
        </p>

        <h4 className="font-bold text-white mt-4">Scope (3 layers) / 范围（三层）</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>A) Core / 核心范围（默认接受）：</strong> Digital Physics, Cellular Automata, Computational Universe Models; Thermodynamics / Information Theory / Entropy /
            Complex Systems; Foundations of AI / Computation / Algorithmic Information; Computational Cosmology; Simulation-based theory exploration.
          </li>
          <li>
            <strong>B) Extended / 扩展范围（接受但提高门槛）：</strong> highly speculative work is accepted but must meet a higher bar: stricter assumption ledger + concrete
            falsifiability paths (or explicit “currently untestable” dependencies + triggers).
          </li>
          <li>
            <strong>C) Not in main track / 暂不进入主轨道：</strong> clinical/human-subject work; engineering proposals with direct real-world harm risk (separate track or rejection).
            <div className="text-sm text-zinc-500 mt-1">
              Motivation / 动机：these domains require ethics/IRB/real-world risk governance that would dilute a theory-first platform.
            </div>
          </li>
        </ul>

        <h4 className="font-bold text-white mt-4">Article Types / 文章类型</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Theory Preprint / 理论预印本：</strong> new theories, models, derivations.
          </li>
          <li>
            <strong>Conjecture Note / 猜想札记：</strong> conjectures, open problems, research agendas.
          </li>
          <li>
            <strong>Proof or Formal Derivation / 证明与形式推导：</strong> rigorous proofs, axiomatic systems.
          </li>
          <li>
            <strong>Computational Experiment / 计算实验：</strong> simulations, CA experiments, numerical exploration.
          </li>
          <li>
            <strong>Verification Report / 验证报告：</strong> independent re-audit, formal verification, counterexample search.
          </li>
          <li>
            <strong>Replication Report / 复现报告：</strong> replicate computational pipelines with consistency checks.
          </li>
          <li>
            <strong>Negative Result / 负结果：</strong> failed paths and boundary conditions (anti-repeat).
          </li>
          <li>
            <strong>Survey or Synthesis / 综述与综合：</strong> literature maps + disputed-point comparison tables.
          </li>
          <li>
            <strong>Critique or Commentary / 批评与评论：</strong> structured critique/addendum to a specific paper.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "provenance",
    title: "Provenance and Tooling Statement / 来源与工具声明",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> Omega is tool-neutral: we do not judge a work by whether the author is human or AI. We judge by falsifiable claims, traceable derivations,
          and reviewable evidence chains. Provenance exists for re-auditability, not moral labeling.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>Omega 工具中立：不因为作者是人类或 AI 判断价值，只看可证伪主张、可追溯推导与可复核证据链。来源披露是为了复核，不是贴标签。
        </p>

        <h4 className="font-bold text-white mt-4">Required field / 必填字段</h4>
        <p className="text-sm text-zinc-400">
          Do not call this “AI Disclosure”. Name it “Provenance and Tooling Statement” to emphasize auditability.
          <br />
          不要叫 AI Disclosure；叫 Provenance and Tooling Statement（来源与工具声明），强调复核，而非审判。
        </p>

        <h5 className="font-bold text-white mt-4">A) Tooling Checklist / 工具清单（多选）</h5>
        <ul className="list-disc pl-5 space-y-2">
          <li>Writing or editing assistance / 写作或编辑辅助</li>
          <li>Code generation used in final pipeline / 代码生成（进入最终管线）</li>
          <li>Data generation or synthetic data used as evidence / 数据生成或合成数据作为证据</li>
          <li>Theorem or proof search assistance / 定理/证明搜索辅助</li>
          <li>Automated citation or literature assistance / 自动化引用或文献辅助</li>
          <li>None / 无</li>
        </ul>

        <h5 className="font-bold text-white mt-4">B) Validation Note / 验证说明（条件必填）</h5>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Required when tooling affects conclusions (e.g., code generation, synthetic evidence, proof search). / 当工具影响结论时必填（如代码生成、合成证据、证明搜索）。
          </li>
          <li>
            Describe how you validated outputs (recompute, cross-check, proof-check, reproduction, manual review, baselines). / 描述如何验证输出（复算、交叉验证、证明检查、复现、人工审阅、对照基准）。
          </li>
        </ul>

        <h4 className="font-bold text-white mt-4">Accountability surface / 责任主体</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Responsible Steward (required) / Responsible Steward（必填）：</strong> at least one accountable human steward must exist for corrections and dispute
            convergence.
          </li>
          <li>
            <strong>Contributor roles / 贡献角色：</strong> Conceptualization / Methodology / Software / Validation / Writing / Visualization.
          </li>
          <li>
            <strong>Non-human contributors / 非人贡献记录：</strong> record model/agent name, version, scope of use, prompt strategy summary, and validation summary (as provenance, not
            “author”).
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "open-review",
    title: "Open Peer Review Norms / 公开评审规范",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> Omega separates <strong>Comments</strong> (conversation) from <strong>Reviews</strong> (structured, citeable assessment). Reviews can be used
          for Level upgrades; comments cannot.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>Omega 将 Comments（讨论）与 Reviews（评审）分开：讨论用于澄清与补充；评审用于结构化、可引用的审查记录。只有评审才可计入 Level 升级。
        </p>

        <h4 className="font-bold text-white mt-4">Comments / 评论规范</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Comment types: Question / Suggestion / Reference / Concern / Counterexample.</li>
          <li>Strong concerns/counterexamples should reference claim IDs (C1…) or anchors (e.g., §2.1, #p3).</li>
          <li>Low-quality but non-violating comments are <strong>soft-hidden</strong> (folded) rather than deleted.</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Reviews / 评审模板（必填字段）</h4>
        <p className="text-sm text-zinc-400">
          Recommendation wording: prefer “Eligible for Level 2 after …” over Accept/Reject.
          <br />
          建议用“Eligible for Level 2 after …”替代传统 Accept/Reject，更符合分层逻辑。
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Summary of contribution / 贡献摘要</li>
          <li>Major strengths / 优势</li>
          <li>Major concerns / 疑虑</li>
          <li>Falsifiability assessment / 可证伪性评估</li>
          <li>Technical correctness assessment / 技术正确性评估</li>
          <li>Verification readiness / 复核就绪度</li>
          <li>Requested changes / 修改请求</li>
          <li>Recommendation / 建议（Level 语言）</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Citeable + COI / 可引用 + 利益冲突</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Reviews are publishable objects (hash + timestamp) and can be cited.</li>
          <li>Review identity may be public or anonymous, but COI is always required (“None” allowed).</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Level impact / 对 Level 的影响</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Level 2: minimum structured reviews + author response/version update, confirmed by editors.</li>
          <li>External AI reviews can never be the sole reason for Level 1 → Level 2.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "ai-audit",
    title: "AI Audit Protocol / AI 审计协议",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> AI is not the judge. AI is an audit tool that produces structured risk signals and re-checkable checklists. Human review decides Level
          upgrades.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>AI 不是裁判；AI 是审计工具，输出结构化风险信号与可复核 checklist；Level 升级由人类评审线决定。
        </p>

        <h4 className="font-bold text-white mt-4">Dual-line review / 双线审查</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Human Review Line:</strong> editors + community reviews (Level upgrades).
          </li>
          <li>
            <strong>AI Audit Line:</strong> audit report (never an acceptance verdict).
          </li>
        </ul>

        <h4 className="font-bold text-white mt-4">7 audit modules / 7 个审计模块</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Completeness Check / 完整性检查（主张/假设/可证伪/相关工作/披露）</li>
          <li>Claim Extraction & Traceability / 主张抽取与证据指针</li>
          <li>Assumption Consistency / 隐含假设提示</li>
          <li>Citation Integrity / 引用结构与存在性（仅风险信号）</li>
          <li>Symbol & Logic Heuristics / 符号与逻辑启发式（非证明）</li>
          <li>Reproducibility Readiness / 复现就绪度 checklist</li>
          <li>Paper-mill & Abuse Signals / 版式化与滥用信号（仅触发人工复核）</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Confidentiality boundary / 保密边界</h4>
        <p className="text-sm text-zinc-400">
          Do not freely send unpublished manuscripts to external model services during review. Prefer built-in audit pipelines, or require explicit author authorization.
          <br />
          审稿过程不得随意把未公开稿件输入外部模型服务；优先内置审计管线，或要求作者明确授权。
        </p>
      </div>
    ),
  },
  {
    id: "data-code",
    title: "Data and Code Availability / 数据与代码可用性",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> For computational work, code and data are part of the evidence chain. Availability is the minimal surface for re-auditability (not virtue
          signaling).
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>对计算型研究而言，代码与数据是证据链的一部分；公开是最小可复核接口（不是“道德加分”）。
        </p>

        <h4 className="font-bold text-white mt-4">Required (when applicable) / 必填（适用时）</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Code URL + commit/hash + runbook.</li>
          <li>Data URL/DOI + version + checksums/hashes + preprocessing scripts.</li>
          <li>Parameter table + deterministic seeds + environment pinning (runtime/OS/dependencies).</li>
          <li>Reproducibility checklist: what to run to reproduce which figure/table/claim.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "ethics-coi",
    title: "Ethical Standards and COI / 伦理与利益冲突",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> Omega is tool-neutral, not responsibility-neutral. All public records must include COI and funding disclosures, and must respect scope limits
          and safety constraints.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>工具中立不等于责任中立。公开记录必须披露 COI 与 Funding，并遵守范围边界与安全约束。
        </p>

        <h4 className="font-bold text-white mt-4">Required disclosures / 必填披露</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Competing interests (“None” allowed) / 利益冲突（无也要写 None）</li>
          <li>Funding (“None” allowed) / Funding（无也要写 None）</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Reporting and investigation / 举报与调查</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Reports trigger a traceable governance action log.</li>
          <li>Editors may issue an Expression of Concern while investigating.</li>
          <li>Outcomes: correction, retraction, or documented no-action.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "dispute-corrections",
    title: "Dispute Arbitration and Corrections / 争议仲裁与纠错撤稿",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          <strong>EN:</strong> Omega’s strength is not “never wrong”. It is the ability to correct transparently. We keep records, reasons, and logs so mistakes become part
          of the auditable history.
        </p>
        <p className="text-sm text-zinc-400">
          <strong>中文：</strong>平台强度不在于“永远正确”，而在于“透明纠错”。记录、理由与日志必须保留，使错误成为可审计历史的一部分。
        </p>

        <h4 className="font-bold text-white mt-4">Record status ladder / 记录状态</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Minor correction / 小更正</li>
          <li>Major correction / 大更正</li>
          <li>Expression of concern / 关注声明</li>
          <li>Retraction / 撤稿（必须保留记录与理由，不能删库）</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Dispute convergence / 争议收敛</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Contested marker / Contested 标记</li>
          <li>Invite verification bounties / 邀请 Verification bounty</li>
          <li>Require author response version v2 / 要求作者发布 v2 回应版本并更新主张/假设</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Bounties must be verifiable / 赏金必须可验收</h4>
        <p className="text-sm text-zinc-400">
          Bounties do not buy conclusions; they buy verification labor.
          <br />
          赏金不是买结论，是买验证劳动。
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Task types: derivation verification, counterexample search, Lean/Coq formalization, simulation reproduction, ablations/benchmarks, literature synthesis maps.</li>
          <li>Required fields: Objective, Deliverable, Acceptance criteria, Review committee, Deadline + payout rule, COI disclosure.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "external-review",
    title: "External Review Import and Attribution / 外部审稿导入与归因",
    version: "v0.1",
    updated: "2025-12-14",
    content: (
      <div className="space-y-4 text-zinc-300">
        <p>
          Omega supports importing external reviews (including agentic/AI reviewer outputs) as <strong>curation</strong>: transforming critique into structured, claim-mapped,
          citeable review objects with explicit attribution.
        </p>
        <p className="text-sm text-zinc-400">
          Motivation: external AI reviews can help surface issues, but they do not replace community/editor accountability.
          <br />
          动机解释：外部 AI 审稿能帮助发现问题，但不能替代社区与编辑的责任。
        </p>

        <h4 className="font-bold text-white mt-4">External Review Artifact (required object form)</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>External reviews are not posted as normal comments. They are imported as an <strong>External Review Artifact</strong> object.</li>
          <li>
            Required fields: paper association (paperId/doi/version), <code>source_type</code> + <code>source_access</code> (+ URL when applicable), curator roles + COI +
            attestation + signature, evidence attachments when screenshot-only/export, and a stable hash.
          </li>
          <li>
            Moderation status: <code>pending</code> / <code>approved</code> / <code>soft_hidden</code> / <code>removed</code>, with governance logs.
          </li>
          <li>Withdrawal/takedown must be supported (record who/when/why).</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Level impact</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Default: external reviews never auto-upgrade Levels.</li>
          <li>May contribute only after Verified Reviewer confirmation or editor “High-signal” marking + author response + version update.</li>
          <li>Guardrail: external AI reviews can never be the sole reason for Level 1 → Level 2.</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Anti-farming (4-layer settlement)</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Base import credit only after approval.</li>
          <li>Normalization bonus only when structured templates are complete.</li>
          <li>Claim-mapping bonus only when mapped to claim IDs/anchors.</li>
          <li>Community validation bonus only when helpful + addressed + high-signal.</li>
        </ul>

        <h4 className="font-bold text-white mt-4">Credit allocation</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Review Generator:</strong> authorship credit for the content.
          </li>
          <li>
            <strong>System Creators:</strong> tooling credit (unclaimed profiles allowed).
          </li>
          <li>
            <strong>Curator:</strong> curation/normalization/claim-mapping/citation-check credit.
          </li>
        </ul>
      </div>
    ),
  },
];

export default function PoliciesPage() {
  const [activeId, setActiveId] = useState(policies[0]?.id || "scope");
  const activePolicy = policies.find((p) => p.id === activeId) || policies[0];

  return (
    <div className="container min-h-[calc(100vh-64px)] py-8 px-4 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 h-full">
        <div className="md:col-span-1 space-y-2">
          <h2 className="text-sm font-bold font-mono text-emerald-500 uppercase mb-4 tracking-widest">Policies / Academic Norms</h2>
          <div className="text-xs text-zinc-500 mb-4">
            EN: Policies are product gates (consistency guarantees). / 中文：政策是产品闸门（平台行为一致性保证）。
          </div>
          <div className="flex flex-col">
            {policies.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm text-left border-l-2 transition-colors",
                  activeId === p.id ? "border-emerald-500 bg-emerald-500/10 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                )}
              >
                <span className="leading-snug">{p.title}</span>
                {activeId === p.id ? <ChevronRight className="w-3 h-3 text-emerald-500" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 border border-zinc-800 bg-zinc-950 p-8 min-h-[500px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-zinc-800 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="font-mono text-zinc-500">
                  {activePolicy.version}
                </Badge>
                <span className="text-xs font-mono text-zinc-600">Updated: {activePolicy.updated}</span>
              </div>
              <h1 className="text-3xl font-serif text-white">{activePolicy.title}</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8">
                <LinkIcon className="w-3 h-3 mr-2" /> Copy Link
              </Button>
              <Button variant="outline" size="sm" className="h-8">
                <Download className="w-3 h-3 mr-2" /> Markdown
              </Button>
            </div>
          </div>

          <div className="prose prose-invert max-w-none prose-p:text-sm prose-li:text-sm">{activePolicy.content}</div>
        </div>
      </div>
    </div>
  );
}
