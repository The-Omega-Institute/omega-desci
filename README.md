<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Omega Institute (Demo UI)

A high-fidelity DeSci publishing + review platform built with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.

- Not zero-backend: production target is **server-side persistence backed by a real database**
- Current prototype remains mock-friendly: `localStorage`, local disk `.omega/`, and fallback mock data (`lib/mockData.ts`)
- No real wallet integration (yet)

## Omega Institute 平台学术定位 Plan / Academic Positioning Plan

### 0. 一句话定位 / 0. One-liner

**中文：** Omega Institute 是一个面向理论型研究与计算型基础研究的开放档案与开放评审平台。我们不根据作者是人类还是 AI 来判断价值。我们只根据可证伪的主张、可追溯的推导、可复核的证据链、公开的评审与纠错记录来累积可信度等级。

**EN:** Omega Institute is an open archive and open review platform for theoretical research and computational foundational research. We do not judge value by whether the author is human or AI. We judge by falsifiable claims, traceable derivations, reviewable evidence chains, and a public record of review and corrections that accumulates trust levels.

### For header/investors / 用于页眉/投资人（短句）

- **EN:** **Omega Institute turns conclusion–evidence alignment into academia’s currency.** Not a faster submit button—an auditable, reproducible, composable structured review protocol.
- **中文：** **Omega Institute：让“结论—证据对齐”成为学术的通用货币。** 不是更快的投稿按钮，而是**可审计、可复现、可组合**的结构化评审协议。

### 1. 先讲动机。为什么 Omega 必须长得和传统期刊不一样 / 1. Motivation: why Omega must look different

**中文：** 不做学术的人最容易困惑的是：为什么不能像论坛一样自由发。为什么还要填一堆字段。为什么还要审核评论。为什么要记录 AI 工具。

我们用四个最简单的动机解释你们的制度设计。

**EN:** The most confusing part for non-academics is: why can’t we post freely like a forum? Why do we need to fill in so many fields? Why do comments need moderation? Why do we record AI tooling?

We explain our institutional design with four simple motivations.

#### 1.1 动机一。我们要解决的不是内容不够。是信任不够 / Motivation 1: The problem isn’t content scarcity—it’s trust scarcity

**中文：** 互联网上从来不缺理论。缺的是让别人相信你不是在自说自话的机制。传统期刊用的是名校名人和编辑部信任链。你们要做的是把信任链从人转移到证据和过程。

**EN:** The internet has never lacked theories. What it lacks is a mechanism that convinces others you’re not just talking to yourself. Traditional journals rely on trust chains built on elite institutions, famous names, and editorial boards. Omega moves the trust chain from people to evidence and process.

**对应平台策略 / Platform strategy:** 把每篇研究记录变成一个可审计对象。它有主张清单。有假设清单。有可证伪路径。有版本记录。有评审与反驳记录。有纠错与撤稿机制。这样读者不用先相信作者身份，只要看证据链。

**EN:** Turn each research record into an auditable object: a claim list, an assumption list, a falsifiability path, version history, review + rebuttal history, and correction/retraction mechanisms. Readers don’t have to trust identities first—they can follow the evidence chain.

#### 1.2 动机二。我们要让高方差探索与学术可信同时成立 / Motivation 2: Make high-variance exploration and academic credibility coexist

**中文：** 高方差探索的意思是：允许大胆假设。允许与主流不同。允许在早期很不成熟。传统期刊往往不喜欢高方差。你们要吸引的就是被这个系统排斥的人。但如果没有可信度分层，高方差就会变成噪音。读者会觉得全是玄学。

**EN:** High-variance exploration means allowing bold hypotheses, allowing deviations from the mainstream, and allowing work to be immature in its early stages. Traditional journals tend to dislike high-variance work. Omega should attract precisely the people filtered out by that system. Without credibility stratification, high-variance exploration becomes noise; readers will experience it as mysticism.

**对应平台策略 / Platform strategy:** 用可信度等级来承载高方差。Level 0 允许存在。Level 1 要求结构完整。Level 2 需要公开评审。Level 3 需要独立复核或验证。平台从不承诺 Level 0 或 Level 1 的结论正确。平台只承诺记录完整可追溯。

**EN:** Use credibility levels to carry high-variance exploration: Level 0 may exist; Level 1 requires a complete structure; Level 2 requires open review; Level 3 requires independent replication or verification. Omega never promises that Level 0 or Level 1 conclusions are correct—it only promises the record is complete and traceable.

#### 1.3 动机三。我们不 judge 人或 AI。但必须能追责和复核 / Motivation 3: We don’t judge humans or AI—but we must support accountability and re-audit

**中文：** 不 judge 的意思是：不因为你是 AI 写的就否定。也不因为你是名校教授就加分。

但学术系统必须有两个底线：责任主体。方法来源。否则任何错误都没法纠正，任何争议都没法收敛。

**EN:** “Not judging” means we don’t dismiss work because it was written with AI, and we don’t award points because the author is a famous professor from an elite institution.

But an academic system needs two non-negotiable baselines: a responsible party and method provenance. Without them, errors cannot be corrected and disputes cannot converge.

**对应平台策略 / Platform strategy:** 你们不做 AI 道德审判。你们做方法与来源披露。只要某种工具或自动化流程影响了推导、代码、数据、结论或图表，它就属于方法学的一部分，必须记录，目的是复核，不是贴标签。

**EN:** Omega does not run an AI morality court. We do method and provenance disclosure. If a tool or automated workflow affects the derivation, code, data, conclusions, or figures, it is part of the methodology and must be recorded. The goal is re-audit, not labeling.

#### 1.4 动机四。我们要把审稿从黑箱变成可复用的公共资产 / Motivation 4: Turn peer review from a black box into a reusable public asset

**中文：** 传统审稿常见问题是：黑箱。慢。个人偏见。审稿意见不能被引用。审稿人贡献不被计入学术资产。

**EN:** Traditional peer review often suffers from: black-box processes, slowness, individual bias, review reports that cannot be cited, and reviewer contributions that are not counted as academic assets.

**对应平台策略 / Platform strategy:** 公开评审。结构化评审。评审可引用。评审可获得声望与奖励。评审也是一种出版对象，不是评论区吵架。

**EN:** Open review. Structured review. Citable reviews. Reviews earn reputation and rewards. A review is a publishable object—not a comment-section fight.

### 2. 平台的北极星原则。所有功能都要服从这五条 / 2. North Star principles: all features must obey these five

**中文：** 这五条是你们以后每次产品取舍的宪法。

**EN:** These five principles are your constitution for every future product trade-off.

1. **Tool-neutral / 工具中立**
   - **中文：** 不因为作者是人类或 AI 评判研究价值。只评判证据链和可复核性。
   - **EN:** Do not judge research value by whether the author is human or AI. Judge only the evidence chain and re-auditability.
2. **Accountability-first / 可追责优先**
   - **中文：** 每条公开研究记录必须有可追责主体。没有责任主体的内容只能作为匿名讨论，不进入学术档案体系。
   - **EN:** Every public research record must have an accountable responsible party. Content without a responsible party can only exist as anonymous discussion and does not enter the academic archive system.
3. **Claim-first / 主张优先**
   - **中文：** 所有讨论都围绕可编号主张展开。没有主张编号就没有可收敛的争论。
   - **EN:** All discussion revolves around numbered claims. Without claim IDs, debates cannot converge.
4. **Falsifiability and verification / 可证伪与可验证**
   - **中文：** 每篇理论研究必须写明假设和可证伪路径。平台鼓励复核、反例搜索、形式化验证、模拟复现，并将其作为最高价值贡献。
   - **EN:** Every theoretical work must state its assumptions and falsifiability path. Omega encourages re-audit, counterexample search, formal verification, and simulation-based reproduction—and treats them as the highest-value contributions.
5. **Transparent governance / 透明治理**
   - **中文：** 任何升级、下架、折叠、撤稿、赏金发放都必须有可追踪记录与理由，避免黑箱。
   - **EN:** Any upgrade, delisting, folding, retraction, or bounty payout must have traceable records and reasons to avoid black-box governance.

### 3. 学科范围与文章类型。偏理论的 Scope 如何写成可执行规则 / 3. Disciplinary scope & article types: making a theory-leaning scope executable

#### 3.1 Scope 三层写法 / 3.1 A three-layer way to write scope

**中文：** 你们在政策里不要只写“我们关注宇宙本质”。那是叙事，不是范围。范围要能用于审核与筛选。

**EN:** Don’t write “we care about the essence of the universe” in policy. That’s narrative, not scope. Scope must be usable for moderation/review and filtering.

**建议用三层 / Recommendation (3 layers):**
- **中文：** A) 核心范围（默认接受）→ B) 扩展范围（接受但标注 speculative/提高门槛）→ C) 暂不进入主轨道（需要单独轨道或不收）。
- **EN:** A) Core scope (accepted by default) → B) Extended scope (accepted but labeled speculative / higher bar) → C) Not in the main track (separate track or not accepted).

**A) 核心范围。默认接受 / A) Core scope (accepted by default)**

- **中文：**
  - Digital Physics。Cellular Automata。Computational Universe Models
  - Thermodynamics。Information Theory。Entropy。Complex Systems
  - Foundations of AI。Foundations of Computation。Algorithmic Information
  - Computational Cosmology。Simulation-based theory exploration
  - 与上述强相关的数学物理与形式化系统
- **EN:**
  - Digital Physics; Cellular Automata; Computational Universe Models
  - Thermodynamics; Information Theory; Entropy; Complex Systems
  - Foundations of AI; Foundations of Computation; Algorithmic Information
  - Computational Cosmology; simulation-based theory exploration
  - Mathematical physics and formal systems strongly related to the above

**B) 扩展范围。接受但标注 speculative 或提高门槛 / B) Extended scope (accepted but labeled speculative or requires a higher bar)**

- **中文：**
  - 宏大统一理论。宇宙本体论式推导  
    必须满足更强结构要求：假设清单更严格。可证伪路径必须具体。必须明确哪些部分是暂时不可检验的。
- **EN:**
  - Grand unification theories; ontological-style deductions about the universe  
    Must meet stronger structural requirements: stricter assumption lists; a concrete falsifiability path; and a clear statement of which parts are currently untestable.

**C) 暂不进入主轨道。需要单独轨道或直接不收 / C) Not in the main track (requires a separate track or not accepted)**

- **中文：**
  - 医学临床与人体实验
  - 任何可能造成现实世界直接风险的工程方案  
    动机解释给外行听就是：这些领域的伦理、合规、风险管理成本太高，会拖垮理论平台的制度专注度。
- **EN:**
  - Clinical medicine and human-subject studies
  - Any engineering proposals that may cause direct real-world risk  
    Plain-language motivation: the ethics, compliance, and risk-management costs in these areas are too high and would dilute (or overwhelm) the institutional focus of a theory-first platform.

#### 3.2 Article Types 文章类型。理论平台建议的最小集合 / 3.2 Article types: a minimal set for a theory platform

**中文：** 你们一开始不要做万能投稿。要让类型和审核标准一一对应。

**EN:** Don’t start with an “anything goes” submission type. Make each type map 1:1 to its review standard.

**最小集合建议 / Minimal recommended set:**

1. **Theory Preprint**
   - **中文：** 新理论、新模型、新推导
   - **EN:** New theories, new models, new derivations
2. **Conjecture Note**
   - **中文：** 猜想、开放问题、研究议程
   - **EN:** Conjectures, open problems, research agendas
3. **Proof or Formal Derivation**
   - **中文：** 严格证明、形式推导、公理体系
   - **EN:** Formal proofs, rigorous derivations, axiomatic systems
4. **Computational Experiment**
   - **中文：** 模拟、元胞自动机实验、数值探索
   - **EN:** Simulations, cellular automata experiments, numerical exploration
5. **Verification Report**
   - **中文：** 独立复核推导、形式化验证、反例搜索报告
   - **EN:** Independent re-audit of derivations, formal verification, counterexample search reports
6. **Replication Report**
   - **中文：** 复现他人计算实验或代码管线
   - **EN:** Replication of others’ computational experiments or code pipelines
7. **Negative Result**
   - **中文：** 失败路径与边界条件，防止重复踩坑
   - **EN:** Failed paths and boundary conditions, to prevent repeated dead ends
8. **Survey or Synthesis**
   - **中文：** 综述、图谱、争议点对照表
   - **EN:** Surveys, maps, comparative tables of disputed points
9. **Critique or Commentary**
   - **中文：** 对某篇论文的结构化批评或补充
   - **EN:** Structured critiques or addenda to a specific paper

**动机解释 / Motivation:**
- **中文：** 文章类型不是为了限制表达，是为了让读者知道应该用什么标准读它。也为了让审核者知道应该检查什么。
- **EN:** Article types are not meant to restrict expression. They tell readers what standard to use when reading, and tell reviewers what to check.

### 4. 可信度等级体系。把存在权和正确性分开 / 4. Credibility levels: separate the right to exist from correctness

**中文：** 这是 Omega 的学术核心机制。你们可以把它做成产品的主视觉。

**EN:** This is Omega’s academic core mechanism. You can make it the product’s main visual.

#### 4.1 四级 Level 定义 / 4.1 Four levels (definitions)

**Level 0 — Archived**

- **中文：**
  - 通过基础格式与合规检查
  - 作为研究记录公开存在
  - 不代表结论可靠
- **EN:**
  - Passes baseline format and compliance checks
  - Exists publicly as a research record
  - Does not imply the conclusion is reliable

**Level 1 — Policy Complete**

- **中文：**
  - 通过范围审查
  - 必填结构齐全：主张清单、假设清单、可证伪路径、相关工作
  - 作者责任与方法来源披露完整
  - 依然不代表正确，只代表可读、可讨论、可复核
- **EN:**
  - Passes scope review
  - Required structure is complete: claim list, assumption list, falsifiability path, related work
  - Author accountability and method/provenance disclosure are complete
  - Still does not imply correctness—only that it is readable, discussable, and re-auditable

**Level 2 — Open Reviewed**

- **中文：**
  - 获得最低数量的结构化评审，例如至少 2 份符合模板的评审
  - 作者完成回应与版本更新或解释
  - 评审记录可引用
- **EN:**
  - Receives a minimum number of structured reviews (e.g., at least 2 template-compliant reviews)
  - Author completes rebuttal and publishes a revision (or explicitly explains why not)
  - Review record is citable

**Level 3 — Verified**

- **中文：**
  - 对理论类更推荐叫 Verified，而不是 Replicated
  - 达成以下之一即可升级：
    - 独立推导复核通过
    - 形式化系统验证通过
    - 计算实验被第三方复现并报告一致
    - 关键反例被发现并促成修正，同时修正版通过复核
  - 动机解释：Level 3 不是给天才正确的勋章，是给过程经得起打的记录
- **EN:**
  - For theory, we prefer “Verified” over “Replicated”
  - Upgrade if any of the following holds:
    - Independent derivation re-audit passes
    - Formal-system verification passes
    - Computational experiment is replicated by a third party with a consistent report
    - A key counterexample triggers a correction, and the corrected version then passes re-audit
  - Motivation: Level 3 is not a medal for “genius correctness”—it’s a record whose process can take hits

#### 4.2 Level 升级的硬约束 / 4.2 Hard constraints for level upgrades

- **中文：**
  - 外部 AI 审稿不能单独触发从 Level 1 升到 Level 2（避免形成“AI 写论文、AI 审论文”的闭环，产生虚假的可信度）
  - 任何 Level 升级必须能指向可公开的审查对象：评审文本、复核报告、形式化文件、复现仓库等
- **EN:**
  - External AI reviews alone cannot trigger an upgrade from Level 1 → Level 2 (to avoid an “AI writes + AI reviews” closed loop that manufactures credibility)
  - Any level upgrade must point to a publicly inspectable audit object: review text, verification report, formal artifacts, replication repository, etc.

### 5. 投稿必填内容：把学术规范做成产品闸门 / 5. Required submission fields: turn academic norms into product gates

**中文：** 你们不想像传统期刊那样看人。那就必须像工程系统那样看结构。结构化字段就是你们的门槛。

**EN:** If we don’t want to judge people like traditional journals, we must judge structure like an engineering system. Structured fields are the platform’s gate.

#### 5.1 基础信息 / 5.1 Basic metadata

- **中文：**
  - Title
  - Abstract（结构化字段，至少四段或四栏）：Problem / Approach / Key Claims / Limitations
  - Article Type
  - Primary Discipline
  - Controlled Keywords（2–5）
  - Free Tags（可选 0–10）
  - License
  - Competing Interests 声明（无也要写 None）
  - Funding 声明（无也要写 None）
- **EN:**
  - Title
  - Abstract (structured; at least four sections): Problem / Approach / Key Claims / Limitations
  - Article Type
  - Primary Discipline
  - Controlled Keywords (2–5)
  - Free Tags (optional 0–10)
  - License
  - Competing Interests statement (required; write “None” if none)
  - Funding statement (required; write “None” if none)

**动机解释 / Motivation:** 不做这些，读者根本无法快速判断一篇理论文章是在解决什么问题，风险在哪里。Without these fields, readers cannot quickly tell what problem a theory paper is addressing or where the risks/limitations are.

#### 5.2 理论必填的三件武器 / 5.2 Three required tools for theory submissions

这三项是 Omega 和普通预印本库的分水岭。

These three are the line that separates Omega from a generic preprint host.

**A) Claims List / 主张清单**

- **中文：**
  - 编号 C1、C2、C3…
  - 每条主张必须指向正文段落或命题编号
- **EN:**
  - Numbered as C1, C2, C3…
  - Each claim must point to a body paragraph reference or a proposition/theorem identifier

**动机解释 / Motivation:** 没有主张清单，争论永远变成感受对骂。主张清单让讨论可以精确落点。Without a claims list, debate collapses into vibes and personal back-and-forth. A claim list makes discussion precise and addressable.

**B) Assumption Ledger / 假设清单**

- **中文：**
  - 每条假设包含：
    - Assumption
    - Why needed
    - What would falsify it
- **EN:**
  - Each assumption includes:
    - Assumption
    - Why needed
    - What would falsify it

**动机解释 / Motivation:** 理论分歧往往不在推导技巧，而在隐含假设。把隐含假设拉到台面上，才有可能达成共识或找到分歧根源。Theoretical disagreements usually come from implicit assumptions, not derivation technique. Making assumptions explicit is how we reach consensus—or pinpoint the real root of disagreement.

**C) Falsifiability Path / 可证伪路径**

- **中文：**
  - 至少一条可检验路径
  - 可以是现实实验，也可以是模拟预测，也可以是形式化反例搜索
  - 若目前不可检验，必须写清楚依赖条件与未来可检验触发点
- **EN:**
  - At least one testable path
  - Can be a real-world experiment, a simulation prediction, or a formal counterexample search
  - If currently untestable, state dependency conditions and the future trigger that would make it testable

**动机解释 / Motivation:** 可证伪路径不是为了否定大胆理论，而是为了让理论从信仰变成研究计划。A falsifiability path is not meant to reject bold theories—it turns a theory from belief into a research plan.

#### 5.3 相关工作与对齐 / 5.3 Relation to prior work & alignment

**Relation to Prior Work / 相关工作（必填）**

- **中文：**
  - 至少 5 条相关文献
  - 并说明：继承点、冲突点、差异点
- **EN:**
  - At least 5 references
  - For each: what you inherit/build on, what you conflict with, and how you differ

**动机解释 / Motivation:** 外行可能觉得引用是装饰。学术上引用是对你不是凭空发明的最基本证明，也是让读者定位你在地图上的位置。Citations are not decoration: they prove you are not inventing in a vacuum and help readers locate your work on the map.

#### 5.4 Provenance and Tooling Statement / 5.4 方法与来源披露（Provenance and Tooling Statement）

不要叫 AI Disclosure。表单应该是中性描述，不是审判。

Do not call this “AI Disclosure”. The form should be a neutral description, not a moral judgment.

**动机解释（给外行）/ Motivation (plain terms):** 我们不是关心你用了什么工具，我们关心你用工具生成的关键内容有没有被验证过。就像工程里必须写依赖和测试报告。 / We don’t care which tools you used; we care whether critical tool-influenced outputs were verified—like engineering requires dependency declarations and test reports.

**A) Tooling Checklist / A) 工具清单（必填，多选）**

- **中文：**
  - 写作或编辑辅助
  - 最终管线使用的代码生成
  - 作为证据的数据生成/合成数据
  - 定理/证明搜索辅助
  - 自动化引用/文献辅助
  - 无
- **EN:**
  - Writing or editing assistance
  - Code generation used in final pipeline
  - Data generation or synthetic data used as evidence
  - Theorem or proof search assistance
  - Automated citation or literature assistance
  - None

**B) Validation Note / B) 复核说明（条件必填）**

- **中文：**
  - 当你选择了会影响结论的工具/自动化流程时必填（例如：代码生成、数据生成/合成、定理/证明搜索）
  - 写清你如何验证工具输出的正确性：复算、交叉验证、形式化证明检查、复现实验、人工逐步审阅、对照基准等
- **EN:**
  - Required when you select tooling that affects conclusions (e.g., code generation, data/synthetic evidence, theorem/proof search)
  - Describe how you validated outputs: recompute, cross-validate, proof-check, reproduce, manual step review, baseline comparisons

#### 5.5 Authors & Responsible Steward / 5.5 作者与责任主体

**Authors / Authors 列表（必填）**

- **中文：** 提供作者列表（逗号分隔）。
- **EN:** Provide an authors list (comma-separated).

**Responsible Steward / Responsible Steward（必填，至少 1 位）**

- **中文：** 至少指定一位责任主体（人或组织）。解释：这不是否定 AI 贡献，而是确保有人对最终发布内容负责，便于纠错与申诉。
- **EN:** Require at least one accountable steward (human or organization). This does not deny AI contributions—it ensures someone is responsible for the final public record for corrections and appeals.

**Contributor Roles / Contributor Roles（必填，CRediT-style）**

- **中文：** 建议使用贡献角色体系；至少包含：Conceptualization、Methodology、Software、Validation、Writing、Visualization（至少填写 1 个角色与贡献者）。
- **EN:** Use a contributor role system; at minimum include: Conceptualization, Methodology, Software, Validation, Writing, Visualization (assign at least one role).

**Non-human Contributors / 非人类贡献者（单独模块记录）**

- **中文：** 模型或代理名称；版本/标识；用途范围；关键参数或提示策略摘要；验证方式摘要。
- **EN:** Model/agent name; version/identifier; scope; key parameters or prompt strategy summary; validation method summary.

**动机解释 / Motivation:** 既保留 AI 贡献的可见性，也不在作者行制造伦理争议。 / Keep AI contributions visible without putting them in the author line and triggering ethics debates.

#### 6. Review & Discussion Dual Channels / 6. 审稿与讨论的双通道体系

**Comments / 讨论**

- **中文：** 目的：提问、澄清、补充文献、轻量争论；不用于 Level 升级的硬依据。
- **EN:** Purpose: questions, clarifications, literature pointers, lightweight debate; not hard evidence for Level upgrades.

**Reviews / 评审**

- **中文：** 目的：结构化评价，形成可引用审查记录；可用于 Level 升级。
- **EN:** Purpose: structured evaluation that becomes a citeable audit record; can be used for Level upgrades.

**动机解释 / Motivation:** 如果把评审做成评论区，最后只剩声量大的人赢。结构化评审是为了把质量标准写进文本，让讨论可以复用。 / If reviews become comment threads, the loudest wins. Structured reviews encode quality standards into reusable, citeable text.

#### 6.2 Comment Minimum Norms / 6.2 评论的最小规范与产品功能

**Comment types are required / 评论必须选择类型**

- **中文：** Question / Suggestion / Reference / Concern / Counterexample
- **EN:** Question / Suggestion / Reference / Concern / Counterexample

**Suggestions should cite targets / 建议类评论需引用目标**

- **中文：** Suggestion / Concern / Counterexample 建议引用主张编号（如 `C1`）或段落锚点（paragraph anchor）。
- **EN:** Suggestion / Concern / Counterexample comments should cite a target: a claim id (e.g., `C1`) or a paragraph anchor.

**Author replies are labeled / 作者回复自动带标签**

- **中文：** 作者身份回复会自动带 `Author` 标签。
- **EN:** Replies posted as an author are automatically tagged `Author`.

**High-quality comment resolution / 高质量评论可被收敛**

- **中文：** 高质量评论可被作者或编辑标记为 `Resolved` 或 `Incorporated`。
- **EN:** Authors/editors can mark high-quality comments as `Resolved` or `Incorporated`.

**Soft hide instead of deletion / 折叠而不是删除**

- **中文：** 低质量但不违规的评论采用 soft hide 折叠，而不是删除。
- **EN:** Low-quality (non-violating) comments are soft-hidden (folded), not deleted.

**动机解释 / Motivation:** 删评会让平台看起来黑箱；折叠能保护讨论质量，又不阻断观点存在。 / Deleting comments looks like black-box governance; folding protects quality while preserving the record.

#### 6.3 Review Template / 6.3 评审模板：让评审成为可引用对象

**Required fields (every Review must include) / 每份评审必填字段**

- **Summary of contribution / 贡献摘要**
- **Major strengths / 主要优势**
- **Major concerns / 主要疑虑**
- **Falsifiability assessment / 可证伪性评估**
- **Technical correctness assessment / 技术正确性评估**
- **Verification readiness / 复核就绪度**
- **Requested changes / 修改请求**
- **Recommendation / 建议**
  - **EN:** Avoid Accept/Reject; use the Level logic, e.g. **“Eligible for Level 2 after: …”**
  - **中文：** 不建议 Accept/Reject；建议用分层逻辑，例如：**“Eligible for Level 2 after: …”**

**Reviews are citeable objects / 评审作为对象应支持**

- **Cite this review / 引用评审**
- **Review hash + timestamp / 评审哈希与时间戳**
- **Reviewer identity or anonymous choice / 评审者身份或匿名选择**
- **COI statement / 利益冲突声明（无也要写 None）**

### 7. AI Audit Standards: AI is not the judge / 7. AI 审稿标准：AI 不是裁判，AI 是审计工具

AI reports exist to make review **auditable and structured**. They do not “decide acceptance”.

AI 报告的目标是让审查**可审计、结构化**，而不是替代学术裁决。

#### 7.1 Two-line review structure / 7.1 双线审稿结构

**Human Review Line / 人类评审线**

- **EN:** Editors + community reviews decide Level upgrades.
- **中文：** 编辑与社区评审决定 Level 升级。

**AI Audit Line / AI 审计线**

- **EN:** Automated audit reports provide structured risk signals and re-checkable checks. AI output does not directly upgrade Levels; it triggers requests for missing materials, red flags, or invitations for verification.
- **中文：** 自动化审计报告输出结构化风险信号与可复核检查结果。AI 结果不直接触发 Level 升级；它只决定要不要补材料、要不要标红、要不要邀请复核。

#### 7.2 Seven-module AI audit report / 7.2 AI 审计 7 模块（每篇论文生成一份报告）

Omega generates an automated audit report per paper. The report is **not** an acceptance decision; it is a structured set of missing-structure checks and risk signals for humans to act on.

Omega 会为每篇论文生成自动化审计报告。该报告**不是**接收/拒稿裁决，而是给人类评审线使用的结构体检与风险信号清单。

1. **Completeness Check / 完整性检查**
   - Checks required structure: **claims**, **assumptions**, **falsifiability path**, **related work**, **disclosures**.
   - 检查必填结构是否齐全：**主张**、**假设**、**可证伪路径**、**相关工作**、**披露声明**。
2. **Claim Extraction and Traceability / 主张抽取与可追溯性**
   - Extracts/normalizes C1..Cn and checks each claim can point to a concrete **SOURCE_REF** and **evidence pointers** (figure/table/data/code/DOI/hash).
   - 抽取/规范化 C1..Cn，并检查每条主张是否能挂钩到具体 **SOURCE_REF** 与 **证据指针**（图表/数据/代码/DOI/哈希）。
3. **Assumption Consistency / 假设一致性**
   - Flags likely **hidden assumptions** introduced in the narrative but missing from the Assumption Ledger.
   - 检测“可能隐含的假设”，并提示哪些假设出现在文本中但未记入 Assumption Ledger。
4. **Citation Integrity / 引用完整性与合理性**
   - Validates citation/DOI format, duplicates, and best-effort existence checks; flags semantic-mismatch risk (risk-only, never a verdict).
   - 检查引用与 DOI 结构、重复、以及“尽力确认”存在性，并提示“引用-论述不匹配”风险（仅风险信号，不作为裁决）。
5. **Symbol and Logic Heuristics / 符号与逻辑启发式体检** *(heuristic / 启发式)*
   - Heuristics for symbol consistency, variable conflicts, dimensional-risk cues, and “derivation jump” language; explicitly not a proof.
   - 启发式提示符号一致性、变量冲突、维度风险、以及“推导跳步”用语，并明确标注“不是证明”。
6. **Reproducibility Readiness / 复现就绪度**
   - Checks code/data anchors, version pinning (commit/hash/DOI), parameters/seeds, and runbook completeness; outputs an actionable checklist.
   - 检查代码/数据锚点、版本锁定（commit/hash/DOI）、参数/seed、运行说明，并给出可执行 checklist。
7. **Paper-mill and Abuse Signals / 版式化与滥用信号**
   - Flags templated/repetitive patterns, abnormal citation signals, and suspicious submission behavior; **human-review trigger only** (never auto-reject).
   - 提示模板化/重复段落、异常引用模式、可疑投稿行为；**仅用于触发人工复核**（不会自动拒稿）。

#### 7.3 Confidentiality & boundaries / 7.3 保密与边界

- **EN:** During review, do not freely send **unpublished manuscripts** to external model services. Prefer the platform’s built-in audit pipeline, or require explicit author authorization before any external processing (to avoid confidentiality and copyright risk).
- **中文：** 评审过程不得把**未公开稿件**随意输入外部模型服务，避免保密与版权风险。应优先使用平台内置审计管线；如需外部处理，必须要求作者明确授权。

### 8. External review importing & credit allocation: turn “reposting” into curation / 8. 外部审稿搬运与信用分配：把搬运升级成学术策展

External reviews already exist across blogs, forums, PubPeer threads, GitHub issues, and social media. Omega treats “importing” as **curation**: structuring, attributing, and mapping those reviews to numbered claims so they become reusable academic assets.

外部审稿与讨论早已散落在博客、论坛、PubPeer、GitHub issue 与社交媒体上。Omega 把“搬运”定义为**学术策展**：结构化 + 归因 + 与编号主张对齐，让外部审稿变成可复用的学术资产。

#### 8.1 External Review Artifact (new object type) / 8.1 新对象类型 External Review Artifact

- **EN:** External reviews must not be pasted as normal comments. They are imported as a first-class **External Review Artifact** with: provenance (source URL + platform), attribution/signature (original reviewer + optional AI system creator), a stable hash, moderation status, and a withdrawal/takedown mechanism.
- **中文：** 外部审稿不能当普通评论贴进来。它必须是一个独立对象：有来源（URL/平台）、署名/归因（原审稿者 + 可选 AI 系统创建者）、稳定哈希、审核状态，以及可撤回/下架机制。

**Required fields / 必填字段（MVP 最小集）：**
- **Association / 关联：** `paper_id` (`paperId`) + (`paper_version_id` (`paperVersionId`) or `doi` (`paperDoi`), recommended)
- **Source / 来源：**
  - `source_type` (`source.type`: `ai_system|human|mixed`)
  - `source_access` (`source.access`: `public_url|token_gated|screenshot_only|export`)
  - `source_url` (`source.url`) when access is `public_url/token_gated`
  - Optional but recommended: `source_system_name` (`source.systemName`), `system_creators[]` (`source.systemCreators`), `source_disclaimer` (`source.disclaimer`)
- **Curator contribution / 搬运者贡献：**
  - `curator_user_id` (`curator.userId`) + `curator_roles[]` (`curator.roles`)
  - `curator_attestation` (`curator.attestation`) + `curator_signature` (`curator.signature`)
  - `curator_coi` (`curator.coi`, “None” allowed)
  - Optional: mapping targets `mappedTargets[]` (claim ids or anchors, e.g. `C1`, `#p3`, `§2.1`)
- **Content structure / 内容结构：** `summary`, `strengths[]`, `weaknesses[]`, `questions[]`, `detailed_comments`, `overall_assessment`
- **Verification & moderation / 验证与审核：**
  - `evidence_attachments[]` required when `source_access` is `screenshot_only/export` (attachments must be redacted)
  - `review_hash` (`hash`) for citation
  - `moderation_status` (`status`: `pending/approved/soft_hidden/removed`) + `editor_notes` (stored as moderation note / status reason)
  - Withdrawal/takedown mechanism must exist: record who/when/why (stored as `withdrawal`)

#### 8.2 Handling by source access / 8.2 两类来源的处理方式

- **A) Public URL external reviews / A) 有公开 URL 的外部审稿**
  - **EN:** Omega stores structured fields and provides **View Original**. Copyright is clearer; if the original text cannot be republished, store structured excerpts + link only.
  - **中文：** Omega 可保存结构化内容，并提供 **View Original**。版权更清晰；如原文不可转载，则只保存结构化摘录与链接。
- **B) Token-gated external reviews / B) token gated 的外部审稿**
  - **EN:** Use **Snapshot + Attestation**: the curator submits a snapshot and signs; Omega stores a hash. A takedown channel is mandatory: rights holders or system owners can request removal and the request is processed via governance logs.
  - **中文：** 采用 **Snapshot plus Attestation**：搬运者提供内容快照并签署声明，平台保存哈希。必须提供下架通道：权利人或系统方提出删除请求，按流程处理（留治理记录）。
- **Motivation / 动机解释：**
  - **EN:** Token-gated content has no universally public citeable link, so attestation + moderation is how responsibility is assigned to the submitter and can be withdrawn.
  - **中文：** token gated 内容没有天然可公开引用链接，所以必须用声明与审核机制把责任落到提交者并可撤回。

#### 8.3 Credit allocation (multi-role attribution) / 8.3 Credit 分配（多角色归因）

- **Review Generator / 评审生成者：** who (human) or what (external AI reviewer system run) generated the review text; gets generator/author credit for this review content.
- **System Creators / 系统创建者：** the creators/maintainers of the reviewer system (e.g., Ng + team); gets **system creator credit**, not this review’s author credit.
- **Curator / 搬运与策展者：** imports into Omega, normalizes structure, maps to claims, adds citations/anchors; gets curation credit and can be attributed with sub-roles (translation/claim-mapping/citation-check).
- **Additional processors / 进一步加工者：** Translator / Claim Mapper / Citation Checker can be credited explicitly when different from the curator (protocol supports multi-role attribution).
- **Key point / 关键点：** System Creators are credited for building the system, not for authoring each generated review; this avoids attribution disputes and academic-ethics confusion.
- **Unclaimed profiles / 未认领 Profile：**
  - **EN:** allow creating public “unclaimed” profiles for credited parties (e.g., famous reviewers or system creators) when they don’t have an Omega account yet.
  - **中文：** 允许为外部名人/系统创建者创建公开的“未认领 profile”（无需先注册账号）。
  - **Public display / 公开展示：** always show the **source link** and an **attribution statement** (who generated the review vs who built the system vs who curated) on the artifact.
  - **Claim later / 未来可认领：** the real person/org can later verify identity and claim the profile + credit links.
  - **Motivation / 动机解释：** you can’t require system creators to register just to receive credit; unclaimed profiles are the most practical way to attribute early and let people claim later.
- **Validation-weighted / 复核加权：** credits unlock/increase only after community validation (helpful marks, issue resolution, Level-upgrade usage), to reduce farming.

#### 8.4 How external reviews affect Levels / 8.4 外部审稿如何影响 Level

- **Default / 默认：** external reviews do **not** trigger Level upgrades.
- **Can contribute (as one input) / 可计入升级条件（作为一部分）：** only when:
  - an internal **Verified Reviewer** confirms the review’s signal (e.g., posts a confirming Omega review referencing the external artifact), **or**
  - an editor marks it as a **High-signal review**,
  **and** the author completes a structured response + version update (or a justified “no-change” response).
- **Guardrail / 底线：** external AI reviews alone can never move a paper from Level 1 → Level 2.

#### 8.5 Anti-farming & reward settlement / 8.5 防刷机制与奖励结算

- **Motivation / 动机解释：**
  - **EN:** External AI reviews can help surface issues quickly, but they do not replace the accountability of the community and editors.
  - **中文：** 外部 AI 审稿能帮助更快发现问题，但不能替代社区与编辑的责任。
- **No rewards for raw importing / 只搬运不结算：**
  - **EN:** importing alone is not a contribution that earns rewards; otherwise the platform will be flooded by “import spam”.
  - **中文：** 仅“导入/搬运”不应结算奖励，否则平台会被导入党刷爆。
- **Reward decomposition (4 layers) / 奖励分解（四层贡献点）：**
  1. **Base import credit / 基础导入分：** only granted after moderation is **approved**. / **审核通过才给**。
  2. **Normalization bonus / 结构化整理加分：** only when the structured template is filled completely (not just a one-line summary). / **结构化模板完整填写才给**。
  3. **Claim mapping bonus / 主张映射加分：** only when critique is mapped to numbered claims or paragraph/section anchors (`C1`, `#p3`, `§2.1`). / **映射到主张编号或段落锚点才给**。
  4. **Community validation bonus / 社区验证加分：** only when it is validated by signals: **helpful votes** + **author marked addressed** + **editor marked high-signal**. / **helpful 投票 + 作者标记 addressed + 编辑标记 high-signal 才给**。
- **Two required anti-cheat controls / 反作弊两条必选：**
  - **New-account throttling or small stake / 新账号限速或小额质押：** throttle curation imports for new accounts (or require a small stake) to prevent burst spam.
  - **Similarity detection + dedupe merge / 相似度检测与重复合并：** merge duplicates; repeated imports of the same source+same paper version earn **0 points** (same provenance, same version, no double counting).
- **Operational safeguards / 配套底线：**
  - **Dedupe key / 去重键：** canonical source URL + paper version + content fingerprint (`review_hash`).
  - **Link-over-copy / 以链接优先：** store links + structured summaries by default; mirror text only when licensed/authorized.
  - **Takedown / 下架：** fast removal on credible copyright/permission complaints with transparent governance logs.

#### 8.6 Rules (attribution, permission, integrity) / 8.6 规则（归因、授权、完整性）

- **Attribution-first / 归因优先：** every imported review must include source URL (when applicable), review generator (who/system), timestamp, and platform label.
- **Link-over-copy / 以链接优先：** default to link + curated summary; only mirror full text when license/permission allows (avoid copyright risk).
- **No meaning drift / 不改写原意：** if quoting, quote verbatim and mark as quote; if summarizing, label as “curated summary” and keep a clear boundary.
- **COI required / 利益冲突必填：** curators must provide a conflict-of-interest statement (“None” allowed).

#### 8.7 MVP product surface / 8.7 MVP 产品形态（最小可行）

- “Import external review” creates an **External Review Artifact** with: paper association (paperId/doi/version), source_type + source_access, attribution, curator roles + attestation + signature, optional evidence attachments, a citeable hash, moderation status, and withdrawal/takedown records.
- Curators must map key points to claim ids (e.g., C1/C2) and attach evidence pointers when possible.

#### 8.8 External AI reviews (agentic reviewers) / 8.8 外部 AI 审稿（Agentic Reviewer 等）

- **EN:** Treat external AI reviews as **third-party artifacts**. Importing requires: system name + creator attribution (if known), source link, and a curator statement that sharing is permitted. Prefer **link + curated structure** over mirroring raw output.
- **中文：** 将外部 AI 审稿视为**第三方产物**。搬运必须包含：系统名称 + 系统创建者归因（如已知）、来源链接，以及策展者对“具备分享权限”的声明。默认采用**链接 + 结构化策展**，而不是镜像原始输出。

#### 8.9 Credit ledger (who earns what) / 8.9 信用分账（谁得什么功劳）

- **Review generator credit / 评审生成者功劳：** credited as the generator/author of this review’s content (human or external AI reviewer run).
- **Curator credit / 策展者功劳：** credited for structuring + claim-mapping + adding evidence anchors (higher credit when used for Level upgrades or verification tasks).
- **System-creator credit / 系统创建者功劳：** when the review is generated via an identifiable reviewer system, attribute tooling credit to its creator/maintainer (not the review’s author credit).
- **Validation-weighted / 复核加权：** credits unlock or increase only after community validation (helpful marks, issue resolution, Level upgrade usage), to reduce “copy-paste farming”.

### 9. Comment & review governance: not deletion, traceable order / 9. 评论与评审的治理：不是删帖，是可追踪的秩序

- **Motivation / 动机解释：**
  - **中文：** 外行最常问：审核评论是不是在控制言论？Omega 的回答是：我们控制的是噪音，不控制反对意见。因为反对意见是科学的一部分。
  - **EN:** The usual question is whether moderation is “speech control”. Omega’s answer: we control noise, not dissent—because dissent is part of science.
- **Governance stance / 治理立场：**
  - **Soft-hide over delete / 折叠优先不删帖：** low-quality but non-violating content is folded (soft-hidden), not erased, to preserve auditability.
  - **Traceable actions / 可追踪动作：** any fold/remove/delist/escalation must have a reason and a record (avoid black-box governance).
  - **Convergence over vibes / 以收敛为目标：** comments are typed and should cite a target (claim id or paragraph anchor) so disputes can converge.
- **Product surface / 产品落地：**
  - **Comments channel / 讨论通道：** Question/Suggestion/Reference/Concern/Counterexample; author/editor-tagged replies; Resolved/Incorporated states; folding instead of deletion.
  - **Reviews channel / 评审通道：** structured templates + citeable hashes; COI required; anonymous allowed; used for Level upgrades (AI is audit line only).

#### 9.1 Traceable governance log (action + reason) / 9.1 审核动作与理由必须可追踪

- **EN:** Every moderation/handling action must emit a governance log entry with **action + reason + actor + timestamp + target** (comment/review/artifact id). This prevents “black-box” deletion and allows disputes/appeals to reference a concrete record.
- **中文：** 每一次审核/处理动作都必须生成治理日志，包含 **动作 + 理由 + 操作者 + 时间戳 + 目标对象**（评论/评审/搬运产物 id）。这能避免“黑箱删帖/黑箱下架”，也让申诉与争议有可引用的事实记录。
- **Motivation / 动机解释：** transparent reasons are your strongest defense against “black-box moderation” accusations. / 透明理由就是你们对抗“黑箱治理”指控的武器。
- **Moderation actions (enum) / 动作枚举（enum）：**
  - `approve` (Approve / 通过)
  - `soft_hide` (Soft hide / 折叠)
  - `remove` (Remove / 移除)
  - `request_evidence` (Request evidence / 要求补引用或推导)
  - `rate_limit` (Rate limit / 限流)
  - `temporary_ban` (Temporary ban / 临时封禁)
- **Reason codes (enum) / 理由枚举（enum）：**
  - `off_topic` (Off-topic / 跑题)
  - `no_evidence_for_strong_claim` (No evidence for strong claim / 强主张无证据)
  - `personal_attack` (Personal attack / 人身攻击)
  - `spam` (Spam / 垃圾内容)
  - `duplicate` (Duplicate / 重复)
  - `misleading_citation` (Misleading citation / 误导性引用)
- **Demo implementation / Demo 落地：**
  - UI: paper drawer → `Governance` tab (shows latest entries; supports copy JSON).
  - Storage: `localStorage["omega_governance_log_v1:<paperId>"]` (demo-only; production should persist server-side and be append-only).

#### 9.2 Tiered permissions (anti-spam + quality) / 9.2 分层权限（反刷 + 讨论质量）

- **Motivation / 动机解释：**
  - **EN:** Open discussion needs anti-spam and quality controls. Tiered permissions let Omega keep the record transparent while preventing “noise takeover”.
  - **中文：** 开放讨论必须同时解决反刷与讨论质量问题。分层权限能在不黑箱删帖的前提下，避免“噪音占领”。
- **Tiers / 四级权限：**
  - **New / 新账号：** comments are **queued** (delayed). Visible to the commenter + editors; editors can `approve` or `remove` with a reason code.
  - **Established / 已建立：** comments publish instantly; normal participation, no moderation powers.
  - **High reputation / 高信誉：** can assist by **marking spam** and **merging duplicates**; can request evidence; actions are logged.
  - **Reviewer / 审稿人：** can publish **structured reviews** (with COI). Reviewer tier also grants high-rep assistance capabilities.
- **Hard rules / 硬约束：**
  - **EN:** External AI reviews cannot by themselves upgrade Level 1 → Level 2; Level upgrades require human/community accountability.
  - **中文：** 外部 AI 审稿不能单独触发 Level 1 → Level 2；Level 升级必须指向人类/社区可追责的审查对象。
- **Demo implementation / Demo 落地：**
  - Actor tiers: `localStorage["omega_actor_tiers_v1"]` (set via UI selectors in `Comments` / `Reviews`).
  - Comment queue: `Comment.visibility = queued|published`; editor can approve queued comments (logged as `approve`).
  - Duplicate merge + removals keep metadata for auditability (`mergedIntoId`, `removed`) and write governance log entries.

### 10. Incentives: don’t reward “taking sides”, reward verification / 10. 激励体系：不奖励站队，要奖励验证

- **North Star / 北极星：**
  - **EN:** Incentives must track **verifiable work** (replications, audits, counterexamples, evidence linkage), not popularity or tribal alignment.
  - **中文：** 激励必须对齐**可验证的贡献**（复现、审计、反例、证据对齐），而不是人气与站队。
- **What gets rewarded / 奖励什么：**
  - **Validators / 验证者：** claim reproducibility tickets, submit PASS/FAIL, and earn only after **random audit** passes (anti-cheat).
  - **Authors / 作者：** earn only after passing **steelman defense** + evidence coverage gates + at least one verified ticket (demo thresholds).
  - **Curators / 策展者：** importing external reviews earns credit in layers (approval → normalization → claim mapping → community validation).
- **Anti-cheat / 反作弊：**
  - **EN:** Reward settlement is delayed and audit-weighted; failures can trigger rollbacks/penalties.
  - **中文：** 奖励延迟结算并绑定随机审计；失败会触发回滚与惩罚。
- **Demo implementation / Demo 落地：**
  - Work orders: `localStorage["omega_work_orders_v1:<paperId>"]` + validator profiles `localStorage["omega_validator_profiles_v1"]`.
  - Author rewards: `localStorage["omega_author_profiles_v1"]` + per-paper claim `localStorage["omega_author_rewards_v1:<paperId>"]`.

#### 10.1 Reputation (what counts) / 10.1 声望（计入规则）

**Eligible contributions / 可计入声望的贡献：**
- **High-quality reviews marked Addressed / 高质量评审被作者标记 Addressed**
- **Key counterexample or key citation confirmed / 提供关键反例或关键引用并被确认**
- **Verification report confirmed / Verification report 通过确认**
- **Replication report confirmed / Replication report 通过对照一致性确认**
- **Literature mapping or keyword corrections adopted / Literature mapping 或关键词纠错被采纳**
- **External review claim-mapping recognized / 对外部审稿做 claim mapping 并被认可**

**Reputation outputs / 声望输出：**
- **User profile contribution graph / 用户 Profile 贡献图谱**
- **Badges / 徽章体系：** Proof Checker、Replication Engineer、Literature Curator、Reviewer Level 3、External Review Curator

**Motivation / 动机解释：**
- **EN:** Reputation is academia’s most effective currency because it is accumulable, displayable, and portable.
- **中文：** 声望是学术世界最有效的货币，因为它可积累、可展示、可迁移。

#### 10.2 Bounties (tasks must be verifiable) / 10.2 赏金（任务必须可验收）

**Definition / 定义：**
- **EN:** A bounty must be a **verifiable task** (not “buying a conclusion”).
- **中文：** 赏金必须定义为**可验证的任务**（不是买结论）。

**Examples of verifiable bounty tasks / 可验收的任务类型示例：**
- Derivation verification / 推导复核
- Counterexample search / 反例搜索
- Formalization into Lean/Coq / 形式化（Lean/Coq）
- Simulation reproduction / 模拟复现
- Benchmark or ablation / 基准或消融
- Literature synthesis map / 文献综述与图谱

**Required fields for publishing a bounty / 赏金发布必填字段：**
- Objective / 目标
- Deliverable / 交付物
- Acceptance criteria / 验收标准
- Review committee / 验收委员会
- Deadline and payout rule / 截止时间与支付规则
- COI disclosure / 利益冲突披露

**Motivation / 动机解释：**
- **EN:** Bounties don’t buy “being right”; they buy verification labor. Verification labor is the infrastructure of scientific progress.
- **中文：** 赏金不是买结论，是买验证劳动；验证劳动是科学进步的基础设施。

### 11. Corrections, retractions, dispute markers / 11. 更正、撤稿、争议标记

#### 11.1 Four record statuses / 11.1 四种记录状态

- **Minor correction / 小更正**
- **Major correction / 大更正**
- **Expression of concern / 关注声明**
- **Retraction / 撤稿**

**Hard rule / 硬约束：**
- **EN:** Retractions must keep a public record + rationale (no silent deletion). Retraction is part of transparent correction, not “shame”.
- **中文：** 撤稿必须保留记录与理由，不能删库；撤稿是透明纠错的一部分，不是耻辱。

#### 11.2 Dispute convergence (Contested → verification) / 11.2 争议收敛（Contested → 可验证）

When a paper becomes highly contested, do **not** “solve it by deleting comments”. Do three things:
- **Contested marker / Contested 标记**
- **Invite verification bounties / 邀请 Verification bounty**
- **Require an author response version (v2) / 要求作者发布回应版本 v2** and update claims/assumptions accordingly

**Motivation / 动机解释：**
- **EN:** Controversy isn’t the enemy; **unstructured** controversy is. The platform’s job is to turn disputes into verifiable objects.
- **中文：** 争议不是敌人；无序争议才是敌人。平台要把争议导向可验证对象。

### 12. Policy documents (each binds to a product gate) / 12. 政策文档集合（每份绑定产品闸门）

**Recommendation: expand from 6 → 8 core policies / 建议：6 份扩展到 8 份核心政策：**
1. **Scope and Article Types / 范围与文章类型** → submission type selector, scope moderation, tags
2. **Provenance and Tooling Statement / 来源与工具声明** → tooling checklist, validation note, trust layer display
3. **Open Peer Review Norms / 公开评审规范** → review templates, citeable reviews, Level 2 upgrade rules
4. **AI Audit Protocol / AI 审计协议** → audit report UI, risk flags, “missing fields” prompts
5. **Data and Code Availability / 数据与代码可用性** → code/data fields, hashes, reproducibility checklist
6. **Ethical Standards and COI / 伦理与利益冲突** → COI/funding, reporting, investigation flow
7. **Dispute Arbitration and Corrections / 争议仲裁与纠错撤稿** → appeals, contested marker, correction/retraction workflow
8. **External Review Import and Attribution / 外部审稿导入与归因** → import object, attestation, credit, takedown/withdrawal

**Motivation / 动机解释：**
- **EN:** Policies are not legal text. They are consistency guarantees: users invest time only when they know how disputes and abuse will be handled.
- **中文：** 政策不是法律条文，而是平台行为一致性的保证；用户知道你们会怎么处理争议和滥用，才敢把时间投在这里。

### 13. Product object model (what Omega actually manages) / 13. 产品对象模型（平台在管理什么）

**Core objects / 核心对象：**
- Paper
- PaperVersion
- Claim
- Assumption
- FalsifiabilityPath
- AIAuditReport
- Review
- Comment
- VerificationReport
- ReplicationReport
- ExternalReviewArtifact
- Bounty
- UserReputationEvent
- ModerationActionLog
- PolicyDocument
- Collection

**Motivation / 动机解释：**
- **EN:** Omega is not “a site to post PDFs”. It is a system to manage research records and verification records. When reviews, bounties, imports, and corrections are first-class objects, trust shifts from “who said it” to “what is traceable”.
- **中文：** Omega 不是“发论文网站”，而是研究记录与验证记录系统。把审稿、复核、外部审稿、赏金、纠错都当成对象管理，平台就不再依赖谁来背书，而依赖记录本身的结构和可追踪性。

### 14. End-to-end flow (text state machine) / 14. 端到端流程（文字版状态机）

#### 14.1 Submission or import / 14.1 投稿或导入

**Entry 1: Import from Zenodo / 入口 1：Import from Zenodo**
- Fill DOI / 填 DOI
- Auto-fetch metadata / 自动拉取基础元数据
- Author completes the three theory tools / 作者补齐三件武器：Claims / Assumptions / Falsifiability
- Fill Provenance and Tooling Statement / 填 Provenance and Tooling Statement

**Entry 2: New submission / 入口 2：New submission**
- Upload PDF / 上传 PDF
- Fill required fields / 填所有必填字段
- Generate paper hash / 生成 paper hash

#### 14.2 Gate 0: automatic checks / 14.2 Gate 0 自动检查

- Field completeness / 字段完整性
- Citation structure / 引用基本结构
- Duplicate-text risk signals / 重复文本风险提示
- Generate AI Audit Report v0 / 生成 AI Audit Report v0

**Output / 输出：** Needs fix / 进入 Gate 1

#### 14.3 Gate 1: editor scope check / 14.3 Gate 1 编辑范围审查

Editors judge only two things:
- In scope or not / 在不在 Scope
- Is structure sufficient to form a discussable record / 结构是否足够形成可讨论记录

**Output / 输出：** publish as Level 0 or Level 1; or return as out-of-scope.

#### 14.4 Public layer after publishing / 14.4 发布后进入公开层

- Paper page public / Paper page 对外可见
- Comments open / 评论区开启
- Reviews open to qualified reviewers or invite-only / 评审区开放给合格评审者或邀请制
- External review import enabled (no auto Level-up) / 外部审稿导入开启（默认不触发升级）

#### 14.5 Reviews + version iteration / 14.5 Review 与版本迭代

- Reviews arrive / Review 产生
- Author responds / 作者回应
- Author publishes v2, v3… / 作者发布 v2、v3…
- AI audit updates / AI Audit report 更新

#### 14.6 Level upgrades / 14.6 Level 升级

- Level 2: editor confirms after minimum structured reviews + author response / Level 2：满足最低结构化评审 + 作者回应后由编辑确认升级
- Level 3: must attach verification/replication/formal artifacts / Level 3：必须有 Verification / Replication / 形式化文件等证据对象

#### 14.7 Corrections and retractions / 14.7 纠错与撤稿

- Report received / 接到举报或发现问题
- Expression of concern / 关注声明
- Investigation / 调查
- Correction or retraction / 更正或撤稿
- All actions are traceable in logs / 所有动作在 log 里可追踪

### 15. Roadmap (staged) / 15. 路线图（分阶段）

#### 15.1 Stage A: enhancements you can ship immediately / 15.1 Stage A：上线就能做的增强功能

1. **Collections / 策展集**
   - **Motivation / 动机：** turn 200+ papers into readable maps.
   - **Product / 功能：** collection pages, reading sequences, contested-point comparison tables.
2. **Claim Mapper / 主张映射工具**
   - **Motivation / 动机：** force discussion to land on claims, not emotion.
   - **Product / 功能：** bind comments/reviews directly to C1/C2…
3. **AIAudit log page / AIAudit 报告页**
   - **Motivation / 动机：** make audits the “signature” feature.
   - **Product / 功能：** per-paper audit log by version, diffed over time.
4. **Citeable review format / 评审可引用格式**
   - **Motivation / 动机：** make reviews an academic asset.
   - **Product / 功能：** citation strings + hashes.
5. **External review import tools / 外部审稿导入工具**
   - **Motivation / 动机：** cold-start the review layer.
   - **Product / 功能：** import → structure → moderation queue → credit display → withdrawal/takedown.

#### 15.2 Stage B: verification engine differentiation / 15.2 Stage B：形成差异化的验证引擎

1. **Formal Verification Track / 形式化验证轨道**
   - Upload Lean/Coq + CI checks → Verified evidence object.
2. **Counterexample Bounty Board / 反例赏金板**
   - Turn contested claims into counterexample tickets with acceptance criteria.
3. **Reproducible Simulation Sandbox / 可复现模拟沙箱**
   - Standard params/seeds, container templates, replication report generator.
4. **Reviewer Reputation Ladder / 评审者声望阶梯**
   - Reviewer levels, invite rights, arbitration rights, badges.

#### 15.3 Stage C: governance + funding without breaking rigor / 15.3 Stage C：接入治理与资助，但不破坏学术严肃性

1. **Grant governance / 资助与赏金治理**
   - Proposals, reviews, disbursement records public by default.
2. **On-chain attestation (fingerprints only) / 链上存证（只存指纹）**
   - Store hashes for version, bounty acceptance, arbitration result (not full texts).
3. **Community juries / 仲裁团**
   - Randomly sampled juries from high-reputation pool; votes + rationales public.

### 16. Motivation map (FAQ-ready) / 16. 动机图谱（可直接放官网 FAQ）

- **Why claims lists? / 为什么要求主张清单？**
  - **EN:** without claim IDs, debate becomes emotional and never converges.
  - **中文：** 没有主张编号，争论会变成情绪吵架，无法收敛。
- **Why assumption ledgers? / 为什么要求假设清单？**
  - **EN:** disagreements often come from hidden assumptions.
  - **中文：** 理论分歧往往来自隐藏假设，不把假设写出来就无法验证。
- **Why falsifiability paths? / 为什么要求可证伪路径？**
  - **EN:** falsifiability is the boundary between science and belief.
  - **中文：** 科学与信仰的分界线就是可证伪；哪怕暂不可检验也要写明未来触发点。
- **Why we don’t judge human vs AI, but still record tools? / 为什么不 judge 人类或 AI，但仍记录工具？**
  - **EN:** tools don’t decide truth, but they change how re-audit must be done.
  - **中文：** 工具不决定对错，但会影响复核方式；记录工具是为了复现与纠错。
- **Why separate comments vs reviews? / 为什么把评论与评审分开？**
  - **EN:** comments optimize for conversation; reviews optimize for convergence.
  - **中文：** 评论区追求热闹，评审追求收敛；混在一起会毁掉学术质量。
- **Why allow external AI review imports, but as a separate object? / 为什么允许外部 AI 审稿搬运，但要做成独立对象？**
  - **EN:** it helps cold-start critique, but requires provenance + attribution + moderation + withdrawal/takedown.
  - **中文：** 外部审稿能快速给反馈，但必须有来源/归因/审核/撤回机制，否则就是版权风险与刷量污染。
- **Why reward verification more than opinions? / 为什么验证贡献奖励更高？**
  - **EN:** science advances on verification labor, not slogans.
  - **中文：** 科学进步靠验证劳动，不靠站队口号。

### 17. Public narrative (manifesto) / 17. 最终对外叙事（学术宣言）

- **中文：** Omega Institute 不以身份定真伪。我们把研究看作一条可审计的链：主张、假设、证据、推导、版本、评审、复核、纠错。任何人类或 AI 只要能提交完整结构与可证伪路径，就拥有被讨论的存在权。任何结论只有在公开评审与独立验证中经得起检验，才获得更高的可信度等级。我们把审稿与验证从黑箱变成公共资产，把科学从身份系统带回证据系统。
- **EN:** Omega Institute does not decide truth by identity. We treat research as an auditable chain: claims, assumptions, evidence, derivations, versions, reviews, verification, and corrections. Any human or AI can earn the right to be discussed by submitting complete structure and a falsifiability path. Any conclusion earns higher trust only by surviving public review and independent verification. We turn review and verification from black boxes into public assets—and bring science back from identity to evidence.

### 18. Next: three publishable texts to ship / 18. 下一步建议立刻落地的三份可发布文本

1. **Scope and Article Types v0.1**
2. **Provenance and Tooling Statement + AI Audit Protocol v0.1**
3. **External Review Import and Attribution v0.1**

### What problem this solves / 这解决了什么问题

- **EN:** Traditional peer review is slow, subjective, and hard to reuse. With AI-generated papers rising, correctness and falsifiability matter more than ever—and we need reviews that can be audited.
- **中文：** 传统审稿慢、主观、不可复用；AI 论文激增之后，“是否正确、是否可证伪”比“写得像不像”更重要，需要能被复核的评审。

### Core idea / 核心思想：结构化认知评审回路（AI-augmented review loop）

Instead of long-form opinions, Omega requires **structured outputs** that can be verified and recomposed elsewhere.

Omega 不要求评审写长文，而是要求输出**结构化、可验证**的结果，能被他处引用/聚合。

**Loop / 闭环：**
1. **Submission with claims + evidence pointers / 投稿：主张 + 证据指针**
   - Authors submit a **claim list** and link each claim to evidence (fig/table/data/code/commit/hash/DOI).
   - 作者提交“主张列表”，并给每条主张附上证据指针（图表/数据/代码/提交/哈希/DOI）。
2. **AI initial triage (minutes) / AI 初审（分钟级）**
   - Runs an epistemic rubric, flags risks (leakage, power, reproducibility), and generates steelman attacks.
   - 运行认识论量表，打风险标签（泄漏/统计功效/可重复性等），生成最强反驳清单。
3. **Structured rebuttal (72h window in UI) / 作者逐点回应（72h 窗口）**
   - Authors respond point-by-point; the defense is scored on evidence alignment and actionable fixes.
   - 作者逐点答复；系统把回应的证据对齐度与可执行改进量化进评分。
4. **Community verification (tickets) / 社区复核（工单化）**
   - “Most controversial claims” become reproduction tickets; validators claim/submit, then a second validator audits.
   - “最有争议的主张”自动变成复现工单；验证者领取/提交，第二位验证者审计确认或驳回。
5. **Versioned conclusion artifacts / 版本化结论与可引用产物**
   - Each run emits a **hash-addressed artifact** (schema-valid JSON) and a shareable review card (URL/iframe).
   - 每次运行都会产出带哈希的 artifact（schema 校验的 JSON）和可分享/可嵌入的评审卡片。

### Why this is defensible / 为什么这是护城河

- **Auditable / 可审计：** scores and labels are backed by explicit evidence links and test stubs/logs.
- **Composable / 可组合：** reviews are structured data, not prose; they can be queried, forked, aggregated, and cited.
- **Extensible / 可扩展：** rubric dimensions and tests are a protocol that different fields can extend.
- **Incentive-aligned / 激励对齐：** rewards go to validators who pass random audit (simulated in this demo).

### Client-side discovery (map) / 客户端探索

- **EN:** The `/map` page renders a keyword co-occurrence graph (papers ↔ keywords) fully in the browser for fast exploration.
- **中文：** `/map` 提供纯前端的关键词共现图（论文↔关键词），让论文库秒变可漫游的探索地图。

### Playbook / 玩法总览

- **EN:** The `/play` page consolidates everything you can try in the current demo UI (including `/map`) and the staged roadmap (Stage A/B/C).
- **中文：** `/play` 一页整合 Demo 现在能玩的所有模块（包括 `/map`），并列出 Stage A/B/C 的未来路线图。

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Open the URL printed by Next.js (usually `http://localhost:3000`, but it may auto-increment to `3001/3002/...` if the port is in use)

## Troubleshooting / 常见问题

- **Windows + OneDrive (`EINVAL readlink .next/...`)**
  - **EN:** If you run this repo inside a OneDrive-synced folder, OneDrive can create cloud placeholders (`ReparsePoint`) inside `.next/`, and Next.js may crash while trying to delete them (`EINVAL: invalid argument, readlink ... .next/...`). This repo automatically runs `node scripts/clean-next.js` before `dev` and `build` to remove `.next/`. If you still hit it, run `node scripts/clean-next.js` manually, or move the repo out of OneDrive (recommended).
  - **中文：** 如果项目在 OneDrive 同步目录里，OneDrive 可能会把 `.next/` 里的构建产物变成云占位（`ReparsePoint`），导致 Next.js 清理时崩溃（`EINVAL: invalid argument, readlink ... .next/...`）。本仓库已在 `dev/build` 前自动执行 `node scripts/clean-next.js` 删除 `.next/`；若仍遇到问题，可手动运行该命令，或将仓库移出 OneDrive（推荐）。

- **404 for `main-app.js` / `layout.css` / `/_next/*`**
  - **EN:** This usually means you are not hitting the Next.js server (or you are opening a static build as if it were a Next app). Run `npm run dev` and open the URL printed in the terminal. For the static showcase, use `npm run pages:dev` / `npm run pages:preview`.
  - **中文：** 一般表示你没有访问到 Next.js 服务（或把静态页面当成 Next 应用来打开）。请用 `npm run dev` 启动并打开终端输出的 URL。纯静态展示版请用 `npm run pages:dev` / `npm run pages:preview`。

## Production build

- Build: `npm run build`
- Start: `npm run start`

## Lint

- `npm run lint`

## Static demo (no Next.js server) / 纯静态 Demo（不需要 Next 服务端）

This repo also ships a static showcase build (GitHub Pages / AI Studio importmap preview). It uses mock data and does **not** rely on Next.js API routes.

本仓库同时提供纯静态展示版（GitHub Pages / AI Studio importmap 预览入口）。静态版只使用 mock 数据，**不会**依赖 Next.js API 路由。

- Dev (opens `gh-pages.html`): `npm run pages:dev`
- Build (outputs `dist/`): `npm run pages:build`
- Preview build: `npm run pages:preview`
- Deploy: publish the `dist/` folder to any static host (e.g., GitHub Pages).

## Zenodo integration

By default, the homepage pulls records from the public Zenodo community `the-matrix` via a Next.js API route:

- List records: `GET /api/zenodo/records?page=1&size=24&sort=newest`
- Fetch a record: `GET /api/zenodo/record/:id`

Optional env vars (server-side only):

- `ZENODO_COMMUNITY` (default: `the-matrix`)
- `ZENODO_API_BASE` (default: `https://zenodo.org/api`)
- `ZENODO_ACCESS_TOKEN` (only needed for private records)

## AI-augmented epistemic review (structured rubric)

Each paper drawer includes an `Epistemic` tab that runs a structured rubric (Pass / Needs Evidence / Fail) and outputs claims, assumptions, testable predictions, follow-ups, and action items.

- Endpoint: `POST /api/review/epistemic`
- Optional: set `GEMINI_API_KEY` in `.env.local` to enable live Gemini output; otherwise it falls back to a deterministic simulated review.

## Steelman attack & adversarial defense

Each paper drawer includes a `Defense` tab:

- Generates a steelman critique (strongest rebuttals) with counter-tests
- Author responds point-by-point
- System scores the defense for evidence alignment + executable counter-tests

Endpoints:

- Generate attacks: `POST /api/review/steelman`
- Score defense: `POST /api/review/steelman/evaluate`

## Submission portal (claims + evidence pointers)

The MVP submission flow lives at:

- `GET /submit`

It supports:

- Import a Zenodo record by id/DOI (prefills metadata)
- Author-provided **claims** + **evidence pointers** (figure/table/data/code/commit/hash/DOI)
- Claims List requirement (Plan §5.2A): claims are numbered `C1..Cn`, and each claim must include a `SOURCE_REF` (paragraph / proposition / theorem id)
- Assumption Ledger requirement (Plan §5.2B): each assumption includes `Assumption`, `Why needed`, and `What would falsify it`
- Falsifiability Path requirement (Plan §5.2C): include at least one test path; if currently untestable, state dependency conditions and the future trigger that would make it testable
- Relation to Prior Work requirement (Plan §5.3): at least 5 references, each with inheritance/conflict/difference notes
- Provenance and Tooling Statement requirement (Plan §5.4): A) Tooling Checklist (multi-select; “None” exclusive) + B) Validation Note required when tooling affects conclusions (e.g., code generation/data generation/proof search)
- Authors & stewardship requirement (Plan §5.5): Authors list + at least one Responsible Steward + CRediT-style Contributor Roles + optional Non-human Contributors module
- One-click **AI initial triage** (epistemic rubric + steelman attacks)
- 72h **defense window** countdown (client-side)

Evidence pointers are currently persisted to localStorage under `omega_evidence_v1:<paperId>` so the archive drawer can reuse them for rubric runs (demo-only; will move to DB-backed storage).

## Community verification (work orders)

Each paper includes a `Verify` tab (and `/submit` includes a `Community` tab) that simulates community replication tickets:

- Validators **claim** a reproducibility work order (auto notebook spec + deterministic random subsample)
- A token **stake** is locked on claim
- Submit `PASS`:
  - If not selected for audit: stake refunded + token reward minted + reputation increase
  - If selected for audit: enters `PASS_PENDING_AUDIT` and rewards release only after a second validator confirms
- Audit flow:
  - Another validator claims the audit and submits `CONFIRM` / `REJECT`
  - `CONFIRM` releases stake + reward to the submitter and mints an audit reward to the auditor
  - `REJECT` burns the submitter stake, applies a reputation penalty, and reopens the ticket
- Submit `FAIL`: rollback (ticket returns to OPEN) + stake burned + reputation decrease

State is currently client-side only (localStorage) in this prototype:

- Validator profiles store: `omega_validator_profiles_v1` (migrates legacy `omega_validator_profile_v1`)
- Per-paper work orders + ledger: `omega_work_orders_v1:<paperId>`
- Each work order supports `EXPORT_JSON` + `FORK_TICKET` for reuse

## Versioned conclusion page

The conclusion report is available at:

- `GET /conclusion?paper=<paperId>`

It snapshots a versioned “final conclusion” that includes:

- Claim–evidence alignment table
- Risk labels + triage summary
- Reproducibility work order status
- Model card + data card
- 0–5 rubric scores with auto-test stubs

Conclusion versions are currently stored in localStorage under `omega_conclusion_v1:<paperId>` (demo-only; will move to DB-backed storage).

The conclusion page also provides export buttons:

- `EXPORT_CONCLUSION_JSON`
- `EXPORT_EVIDENCE_JSON`
- `EXPORT_WORKORDERS_JSON`

The conclusion page also includes an `Incentives` panel (mock, local-only):

- Author profiles store: `omega_author_profiles_v1`
- Per-paper author reward claim: `omega_author_rewards_v1:<paperId>`

## Backend protocol (JSON Schema + artifacts + queue)

This repo includes a backend surface (Next.js Route Handlers). Persistence is still mock-friendly today, but the target is DB-backed storage:

- **Review protocol**: JSON Schema with `claims[]`, `evidence[]`, `tests[]`
  - Schema: `GET /api/review/protocol/schema`
  - Validate payload: `POST /api/review/protocol/validate`
- **Review engine**: orchestrates rubric + steelman + rule checks and emits a citeable artifact
  - Run engine: `POST /api/review/engine`
  - Artifacts list: `GET /api/artifacts`
  - Artifact fetch: `GET /api/artifacts/<hash>` (accepts `sha256:<hex>` or `<hex>`)
- **Review cards (share + embed)**: generate a card from arXiv/Zenodo and share it as a URL or iframe
  - Generator UI: `GET /arxiv`
  - arXiv import: `POST /api/review/arxiv`
  - Zenodo import: `POST /api/review/zenodo`
  - Card page: `GET /card/<hash>`
- **Bounty marketplace (demo)**: claim + submit + audit top controversial-claim tickets
  - UI: `GET /market`
  - List bounties: `GET /api/market/bounties`
  - Claim: `POST /api/market/bounties/claim`
  - Submit PASS/FAIL: `POST /api/market/bounties/submit`
  - Audit claim: `POST /api/market/bounties/audit/claim`
  - Audit confirm/reject: `POST /api/market/bounties/audit/submit`
- **Keyword co-occurrence map (client-side)**: explore the paper library as a navigable graph (DB can be added as a data source)
  - UI: `GET /map`
  - Paper cards: keyword badges deep-link into the map (`/map?keyword=<kw>`)
- **Task queue (demo)**: reproduction tickets are enqueued (simulated by default)
  - Jobs list: `GET /api/queue/jobs`
  - Job status: `GET /api/queue/job/<id>`

Optional server env vars:

- `OMEGA_ARTIFACT_DIR` (e.g. `.omega/artifacts`) to persist emitted artifacts to disk (local-only)
- `OMEGA_QUEUE_MODE` = `simulated` (default) or `docker` (marks jobs as sandbox-required)
