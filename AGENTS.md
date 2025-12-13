# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router routes/layouts (e.g. `app/page.tsx`, `app/policies/page.tsx`).
- `components/`: reusable UI and feature modules:
  - `components/archive/`: archive views (cards, filters, drawers).
  - `components/layout/`: shared page chrome (header/footer).
  - `components/ui/shadcn.tsx`: local UI primitives (Radix + Tailwind).
- `lib/`: shared utilities and data (`lib/utils.ts`, `lib/mockData.ts`) plus `lib/mocks/` used to run the UI outside a real Next runtime.
- `metadata.json`: AI Studio app metadata (name/description).
- `index.html` + `index.tsx`: standalone preview entry (AI Studio/importmap). If you change routing or Next-specific imports, keep these preview mocks working.

## Build, Test, and Development Commands
- Prerequisite: Node.js 18+.
- `npm install`: install dependencies.
- `npm run dev`: start the local dev server.
- `npm run lint`: run ESLint via Next’s config.
- `npm run build`: create a production build.
- `npm run start`: run the production server (after `npm run build`).

## Coding Style & Naming Conventions
- TypeScript + React; prefer functional components and explicit prop types.
- Use Tailwind utility classes; use `cn()` from `lib/utils.ts` for conditional classNames.
- If you change design tokens, keep `tailwind.config.ts` and the Tailwind config in `index.html` aligned (preview).
- Naming: components `PascalCase.tsx`, hooks `useSomething`, utilities `camelCase`.
- Imports: prefer the `@/` alias (repo root), e.g. `import { cn } from "@/lib/utils"`.
- Next/App Router: add `"use client";` at the top of files that use hooks/state.

## Testing Guidelines
- No test runner is currently configured (no `npm test` script). If you add tests, use `*.test.ts(x)` and include “how to run” instructions in the PR.

## Commit & Pull Request Guidelines
- This repository currently has no Git history; use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) with imperative, scoped messages.
- PRs should include: a short summary, testing/verification steps, linked issues (if any), and screenshots/screen recordings for UI changes.

## Git Workflow (Auto Push)
- Remote `origin`: `https://github.com/The-Omega-Institute/omega-desci.git`
- Default branch: `main`
- Auto-push after each commit: `.githooks/post-commit` (enable hooks with `git config core.hooksPath .githooks`)
- Disable auto-push: `git config omega.autoPush false` (re-enable: `git config omega.autoPush true`)

## Security & Configuration Tips
- Keep secrets in `.env.local` (e.g. `GEMINI_API_KEY`) and never commit API keys.
- Avoid logging or hardcoding credentials in client-side code.

---

## Current Demo Features (Omega Institute)

### Product Positioning
- One-liner: **Omega Institute makes conclusion–evidence alignment academia’s currency** via an auditable, reproducible, composable structured review protocol.

### Core Pages (Next.js App Router)
- Archive (Zenodo-backed): `GET /` — lists papers (Zenodo community `the-matrix` by default) with a detail drawer per paper.
- Policies: `GET /policies`
- Submission portal: `GET /submit` — author enters claims + evidence pointers, then runs AI initial triage and community verification simulation.
- Conclusion report: `GET /conclusion?paper=<paperId>` — versioned, exportable conclusion snapshot.
- Review card generator: `GET /arxiv` — paste arXiv/Zenodo link → generate a citeable review artifact + shareable card.
- Review card: `GET /card/<hash>` — high-fidelity review card with embed snippet and artifact download.
- Bounty marketplace: `GET /market` — claim/submit/audit reproduction bounties (server-persisted demo store).
- Keyword co-occurrence map (zero DB): `GET /map` — interactive paper↔keyword graph with hover highlight, search, and archive deep-links.

### Data Sources (No DB, Mock-Friendly)
- Zenodo community ingestion (server fetch → UI): `GET /api/zenodo/records` and `GET /api/zenodo/record/:id` (default community: `the-matrix`).
- arXiv metadata ingestion (server fetch → review engine): `POST /api/review/arxiv` (arXiv Atom API).
- Client fallback: if network/Zenodo unavailable, UI falls back to `lib/mockData.ts`.

### Evidence & Claim Capture (Submission + Reuse)
- Evidence pointers support figure/table/data/code/commit/hash/DOI references (mock, user-entered).
- Evidence + claim-evidence mapping are persisted client-side so the archive drawer can reuse them:
  - Evidence store: `localStorage["omega_evidence_v1:<paperId>"]`

### AI-Augmented Review Loop (Structured Rubric, Not Vibes)
- Epistemic rubric (Pass / Needs Evidence / Fail), claims extraction, assumptions, predictions, follow-ups:
  - Endpoint: `POST /api/review/epistemic`
  - Runs in `auto` mode with optional Gemini; falls back to deterministic simulated output when no key.
- Steelman critique (strongest rebuttals) + counter-tests:
  - Endpoint: `POST /api/review/steelman`
- Defense evaluation (author response scored against evidence alignment):
  - Endpoint: `POST /api/review/steelman/evaluate`
- Review engine orchestrator (ties everything together + emits citeable artifact):
  - Endpoint: `POST /api/review/engine`
  - Outputs: structured claims/evidence/tests + risk flags + attacks + top bounty tasks.

### Review Protocol (JSON Schema “wire format”)
- Schema: `GET /api/review/protocol/schema`
- Validator: `POST /api/review/protocol/validate` (Ajv 2020-12)
- Protocol files:
  - Schema: `lib/review/protocol/omega-review-protocol-v1.schema.json`
  - Types: `lib/review/protocol/types.ts`

### Citeable Artifacts (Server-Persisted, Local-Only)
- Artifacts are emitted by the review engine and addressed by `sha256:<hex>`.
- Store:
  - In-memory + disk persistence (default `.omega/artifacts`, configurable via `OMEGA_ARTIFACT_DIR`).
- API:
  - List: `GET /api/artifacts`
  - Fetch: `GET /api/artifacts/<hash>` (accepts `<hex>` or `sha256:<hex>`)
- Review card embed:
  - `GET /card/<hash>?embed=1` hides site chrome for iframe use.

### Reproducibility Work Orders (Client-Side Simulation)
- Work orders are generated per paper and can be claimed/submitted/audited (mock incentives):
  - Stored per paper: `localStorage["omega_work_orders_v1:<paperId>"]`
  - Validator profiles: `localStorage["omega_validator_profiles_v1"]`
  - Ledger entries track stake/reward/penalties in a simulated economy.

### “Most Controversial 3 Claims” → Bounty Tickets (Quickline #2)
- Each review artifact includes 3 reproduction tickets ranked by a controversy heuristic.
- These tickets seed the bounty marketplace automatically whenever `POST /api/review/engine` runs.

### Bounty Marketplace (Server-Persisted Demo)
- Store:
  - Disk file `.omega/market.json` (configurable via `OMEGA_MARKET_FILE`)
- API:
  - List: `GET /api/market/bounties`
  - Fetch: `GET /api/market/bounties/<id>`
  - Claim: `POST /api/market/bounties/claim`
  - Submit PASS/FAIL: `POST /api/market/bounties/submit`
  - Audit claim: `POST /api/market/bounties/audit/claim`
  - Audit confirm/reject: `POST /api/market/bounties/audit/submit`

### Keyword Co-occurrence Map (Zero DB, Exploratory Navigation)
- Page: `GET /map`
- Graph model:
  - Nodes: Paper (circle) + Keyword (diamond)
  - Links: Paper↔Keyword (TopK per paper; keywords filtered by minimum reuse)
  - Hover:
    - Paper hover highlights its keywords + 2-hop related papers (shared keywords)
    - Keyword hover highlights all connected papers
  - Search:
    - Title/keyword search; keeps neighbor context visible
  - Deep links:
    - Paper cards’ keyword badges jump to `/map?keyword=<kw>`
    - Selected paper links back to archive drawer `/?paper=<paperId>`

### Queue + Safety (Demo Infrastructure)
- Task queue (demo): `GET /api/queue/jobs`, `GET /api/queue/job/<id>`
- Rate limiting (in-memory): applied to review and market write endpoints.
- Safety scan (regex-based): flags obvious secrets/sensitive strings in review input.

### Env Vars (Optional)
- `ZENODO_COMMUNITY` (default `the-matrix`), `ZENODO_API_BASE`, `ZENODO_ACCESS_TOKEN`
- `GEMINI_API_KEY` to enable live Gemini output (otherwise simulated)
- `OMEGA_ARTIFACT_DIR` to persist artifacts to disk
- `OMEGA_MARKET_FILE` to persist the bounty market to disk
- `OMEGA_QUEUE_MODE` (`simulated` default)
