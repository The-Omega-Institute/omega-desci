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
- Windows/OneDrive note: OneDrive can create `ReparsePoint` placeholders in `.next/` and crash Next.js cleanup with `EINVAL readlink`; `dev`/`build` run `scripts/clean-next.js` automatically, but moving the repo out of OneDrive is the most reliable fix.
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
  - Drawer deep-link: `/?paper=<paperId>` opens a paper directly.
  - Keywords are clickable: badges jump to `/map?keyword=<kw>` (keyword-linked exploration).
  - AI Audit report tab (Plan §7.2): seven-module per-paper audit report (**risk signals only**; never an acceptance verdict).
    - Module 1 `Completeness Check`: required structure (claims, assumptions, falsifiability path, related work, disclosures).
    - Module 2 `Claim Extraction & Traceability`: C1..Cn + SOURCE_REF + claim→evidence pointer linkage (fig/table/data/code/DOI/hash).
    - Module 3 `Assumption Consistency`: heuristic hidden-assumptions list vs. Assumption Ledger coverage gaps.
    - Module 4 `Citation Integrity`: citation/DOI format checks + duplicate signals + best-effort DOI existence checks.
    - Module 5 `Symbol & Logic Heuristics`: explicitly heuristic symbol-consistency + derivation-jump cues (not a proof checker).
    - Module 6 `Reproducibility Readiness`: actionable checklist for code/data anchors, version pinning, params/seeds, and runbook completeness.
    - Module 7 `Paper-mill & Abuse Signals`: templated/repetitive patterns + abnormal citation signals; **human-review trigger only** (never auto-reject).
  - Dual channels in the drawer (Plan §6):
    - `Comments`: typed Question/Suggestion/Reference/Concern/Counterexample; optional target refs like `C1`/anchors; author/editor-tagged replies; `Resolved`/`Incorporated`; soft-hide folding instead of deletion (moderation controls noise, not dissent).
    - `Reviews`: structured template (Plan §6.3) + citeable object (hash + timestamp) with reviewer identity or anonymous choice + COI statement; uses Level-based recommendation phrasing (e.g. “Eligible for Level 2 after …”) and can be used for Level upgrades.
      - Authors can mark high-quality reviews as **Addressed** (stores `review.addressed` with timestamp + actor; used as a reputation signal in Plan §10.1).
    - `Governance` (Plan §9.1): per-paper governance log records moderation actions with **action + reason + actor + timestamp**; moderation uses explicit enums for actions (`approve|soft_hide|remove|request_evidence|rate_limit|temporary_ban`) and reasons (`off_topic|no_evidence_for_strong_claim|personal_attack|spam|duplicate|misleading_citation`).
    - Tiered permissions (Plan §9.2): new community accounts’ comments are **queued** (visible to the commenter + editors); editors can approve/remove with reason codes; high-rep users can assist by marking spam/merging duplicates/requesting evidence; **structured reviews require Reviewer tier** (COI required; anonymous allowed).
    - External review import (Plan §8 / §8.1):
      - Imports external reviews (including external AI/agentic reviewer outputs) as a first-class **External Review Artifact** object (not a normal comment) with paper association, `source_type` + `source_access` (+ URL when applicable), curator roles + attestation + signature, optional evidence attachments (required for screenshot-only/export), a stable hash, moderation status (`pending|approved|soft_hidden|removed`), and withdrawal/takedown records.
      - Public display: always shows source link + attribution roles (Review Generator / System Creators / Curator). System Creators are recorded as **unclaimed profiles** (claimable later; no forced registration for credit).
      - Level impact (Plan §8.4): external reviews never auto-upgrade Levels; they can only contribute as one input after Verified Reviewer confirmation or editor “High-signal” marking, plus author response + version update.
      - Anti-farming (Plan §8.5): no rewards for raw importing; rewards/credits are decomposed into 4 layers (1) base import credit only after approval, (2) normalization bonus only for complete structured templates, (3) claim-mapping bonus only when mapped to claim ids or anchors, (4) community validation bonus only when helpful + addressed + high-signal; required anti-cheat: new-account throttling/stake + similarity dedupe merging (same source+version duplicates get 0 points).
      - Demo controls: paper drawer lists ERAs with status badges + cite/copy hash + editor moderation (approve/soft-hide/remove/pending) and curator withdrawal (demo actor switch); link-over-copy by default; deduped by source URL + hash to reduce spam.
- Keyword co-occurrence map (zero DB): `GET /map` — interactive paper↔keyword graph with hover highlight, search, and archive deep-links.
- Review card generator: `GET /arxiv` — paste an arXiv/Zenodo link → generate a citeable review artifact + shareable card.
- Review card: `GET /card/<hash>` — high-fidelity review card with embed snippet and artifact download (`?embed=1` hides chrome).
- Submission portal: `GET /submit` — author enters claims + evidence pointers, then runs AI initial triage and community verification simulation.
  - Required metadata gates (Plan §5.1): Title; structured Abstract (Problem/Approach/Key Claims/Limitations); Article Type; Primary Discipline; Controlled Keywords (2–5); optional Free Tags (0–10); License; Competing Interests (“None” allowed); Funding (“None” allowed).
  - Theory structure gates (Plan §5.2): numbered `C1..Cn` claims (+ `SOURCE_REF`); Assumption Ledger (Assumption / Why needed / What would falsify it); Falsifiability Path (at least one test path or explicit dependency + trigger).
  - Alignment gates (Plan §5.3–§5.5): at least 5 prior-work refs; Provenance + Tooling Statement (tool checklist + validation note); Authors + Responsible Steward + contributor roles + optional non-human contributors.
  - Enforcement: AI review is blocked until required fields are complete.
- Conclusion report: `GET /conclusion?paper=<paperId>` — versioned, exportable conclusion snapshot (built from stored review + evidence + work orders).
- Bounty marketplace: `GET /market` — claim/submit/audit reproduction bounties (server-persisted demo store).
- Policies: `GET /policies` — 8 core policy docs (Plan §12):
  - Scope and Article Types
  - Provenance and Tooling Statement
  - Open Peer Review Norms
  - AI Audit Protocol
  - Data and Code Availability
  - Ethical Standards and COI
  - Dispute Arbitration and Corrections
  - External Review Import and Attribution
- Profile: `GET /profile` — demo reputation page: contribution graph + badges (Proof Checker / Replication Engineer / Literature Curator / …), aggregated from local stores (Plan §10.1).

### Data Sources (No DB, Mock-Friendly)
- Zenodo community ingestion (server fetch → UI): `GET /api/zenodo/records` and `GET /api/zenodo/record/:id` (default community: `the-matrix`).
- arXiv metadata ingestion (server fetch → review engine): `POST /api/review/arxiv` (arXiv Atom API).
- Client fallback: if network/Zenodo unavailable, UI falls back to `lib/mockData.ts`.

### Client-Side Persistence (localStorage)
- Submission portal draft store:
  - `omega_submission_portal_v2` (legacy: `omega_submission_portal_v1`)
- Per-paper stores:
  - `omega_paper_v1:<paperId>` (submission snapshot)
  - `omega_submission_meta_v1:<paperId>` (submission metadata)
  - `omega_evidence_v1:<paperId>` (evidence pointers + claim↔evidence mapping)
  - `omega_epistemic_review_v2:<paperId>` (rubric output + radar data)
  - `omega_steelman_v1:<paperId>` (steelman attacks + author defense)
  - `omega_reviews_v1:<paperId>` (community reviews; stored payload version v2)
  - `omega_external_review_artifacts_v1:<paperId>` (External Review Artifacts: provenance + hash + moderation + withdrawal)
  - `omega_comments_v1:<paperId>` (typed comments, replies, soft-hide, resolution)
  - `omega_governance_log_v1:<paperId>` (governance logs: action + reason + actor + timestamp, demo-only)
  - `omega_work_orders_v1:<paperId>` (verification tickets + status)
  - `omega_conclusion_v1:<paperId>` (versioned conclusion snapshot)
- Profiles / convenience:
  - `omega_validator_profiles_v1` (legacy: `omega_validator_profile_v1`)
  - `omega_author_profiles_v1`, `omega_author_rewards_v1:<paperId>`
  - `omega_profile_active_handle_v1` (last selected handle on `/profile`)
  - `omega_market_handle_v1` (market handle)
  - `omega_actor_tiers_v1` (demo identity tiers: new/established/high_reputation/reviewer)
  - `omega_actor_sanctions_v1` (demo moderation: rate limits + temporary bans by actor name)
  - `omega_curation_import_rate_v1` (curation anti-spam: new-account import throttling, demo-only)

### Evidence & Claim Capture (Submission + Reuse)
- Evidence pointers support figure/table/data/code/commit/hash/DOI references (mock, user-entered).
- Evidence + claim-evidence mapping are stored client-side so the archive drawer, conclusion page, and review card can reuse them.

### AI-Augmented Review Loop (Structured Rubric, Not Vibes)
- AI is an audit tool (Plan §7): AI outputs are structured audit reports and do not directly decide Level upgrades; human reviews do.
- Confidentiality boundary (Plan §7.3): do not send unpublished manuscripts to external model services during review; prefer built-in audit pipelines or require explicit author authorization.
- DOI resolver (best-effort, used by Audit Module 4): `GET /api/review/citation/doi?doi=<doi>`
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
- Review card embed: `GET /card/<hash>?embed=1` hides site chrome for iframe use.

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

### Key Implementation Files
- Archive UI: `components/archive/PaperCard.tsx`, `components/archive/PaperDrawer.tsx`, `components/archive/FilterSidebar.tsx`
- Zenodo adapter: `lib/zenodo.ts`, `app/api/zenodo/records/route.ts`, `app/api/zenodo/record/[id]/route.ts`
- Map: `app/map/MapClient.tsx`
- Submission portal: `components/submit/SubmissionPortal.tsx`
- Review UI: `components/review/EpistemicReviewPanel.tsx`, `components/review/RadarChart.tsx`, `components/review/SteelmanDefensePanel.tsx`, `components/review/VerificationWorkOrdersPanel.tsx`
- Conclusion: `components/conclusion/ConclusionPage.tsx`, `components/conclusion/IncentivesPanel.tsx`
- Artifact store: `lib/server/artifacts.ts`, `app/api/artifacts/route.ts`, `app/api/artifacts/[hash]/route.ts`
- Market store: `lib/server/market.ts`, `app/api/market/bounties/*`

### Env Vars (Optional)
- `ZENODO_COMMUNITY` (default `the-matrix`), `ZENODO_API_BASE`, `ZENODO_ACCESS_TOKEN`
- `GEMINI_API_KEY` to enable live Gemini output (otherwise simulated)
- `OMEGA_ARTIFACT_DIR` to persist artifacts to disk
- `OMEGA_MARKET_FILE` to persist the bounty market to disk
- `OMEGA_QUEUE_MODE` (`simulated` default)
