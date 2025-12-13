<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Omega Institute (Front-end Demo)

A high-fidelity, futuristic DeSci publishing platform UI built with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.

- No backend
- No real wallet integration
- Mock data only (`lib/mockData.ts`)

## Academic Positioning Plan / 学术定位总纲

### One-liner / 一句话定位

- **EN:** **Omega Institute turns conclusion–evidence alignment into academia’s currency.** Not a faster submit button—an auditable, reproducible, composable structured review protocol.
- **中文：** **Omega Institute：让“结论—证据对齐”成为学术的通用货币。** 不是更快的投稿按钮，而是**可审计、可复现、可组合**的结构化评审协议。

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

### Zero-backend discovery / 零后端探索

- **EN:** The `/map` page renders a keyword co-occurrence graph (papers ↔ keywords) fully in the browser for fast exploration.
- **中文：** `/map` 提供纯前端的关键词共现图（论文↔关键词），让论文库秒变可漫游的探索地图。

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Open `http://localhost:3000`

## Production build

- Build: `npm run build`
- Start: `npm run start`

## Lint

- `npm run lint`

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
- One-click **AI initial triage** (epistemic rubric + steelman attacks)
- 72h **defense window** countdown (client-side)

Evidence pointers are persisted to localStorage under `omega_evidence_v1:<paperId>` so the archive drawer can reuse them for rubric runs.

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

State is client-side only (localStorage):

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

Conclusion versions are stored in localStorage under `omega_conclusion_v1:<paperId>`.

The conclusion page also provides export buttons:

- `EXPORT_CONCLUSION_JSON`
- `EXPORT_EVIDENCE_JSON`
- `EXPORT_WORKORDERS_JSON`

The conclusion page also includes an `Incentives` panel (mock, local-only):

- Author profiles store: `omega_author_profiles_v1`
- Per-paper author reward claim: `omega_author_rewards_v1:<paperId>`

## Backend protocol (JSON Schema + artifacts + queue)

This demo now includes a minimal backend surface (still mock-friendly) to match a production-style architecture:

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
- **Keyword co-occurrence map (zero DB)**: explore the paper library as a navigable graph
  - UI: `GET /map`
  - Paper cards: keyword badges deep-link into the map (`/map?keyword=<kw>`)
- **Task queue (demo)**: reproduction tickets are enqueued (simulated by default)
  - Jobs list: `GET /api/queue/jobs`
  - Job status: `GET /api/queue/job/<id>`

Optional server env vars:

- `OMEGA_ARTIFACT_DIR` (e.g. `.omega/artifacts`) to persist emitted artifacts to disk (local-only)
- `OMEGA_QUEUE_MODE` = `simulated` (default) or `docker` (marks jobs as sandbox-required)
