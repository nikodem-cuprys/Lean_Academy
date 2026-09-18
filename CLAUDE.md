# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

LeanAcademy is a scientifically-grounded cognitive-training platform (working memory + reading-efficiency training). Current phase and progress are intentionally not hardcoded here — this line has already gone stale once. See `docs/kanban.md`'s Done/Ready/Backlog sections for exactly what's built vs. remaining, and `docs/development-plan.md` for phase-level status. The repository holds:

- the full research/product/planning documentation set (`docs/*`, `data/evidence-registry.json`);
- an interactive design-canvas prototype under `prototype/` (static Design Component HTML — the approved visual reference the real UI should be built against);
- a pnpm-workspace monorepo: `apps/{web,api}` + 8 `packages/*`.

Full original product spec: `project_prompt.txt`.

## Commands

Run from the repo root unless noted. This is a pnpm workspace — always use `pnpm`, not `npm`/`yarn`.

```bash
pnpm install              # install everything
pnpm dev                  # apps/web dev server (Next.js)
pnpm build                # build every app + package
pnpm typecheck            # tsc --noEmit across every app + package
pnpm test                 # vitest across every package (apps have no tests yet)
pnpm lint                 # eslint (apps/web) + placeholders elsewhere

pnpm db:generate          # regenerate the Prisma client after editing schema.prisma
pnpm db:migrate           # run/create a Prisma migration (needs DATABASE_URL — see .env.example)
pnpm --filter @lean-academy/db seed   # sync EvidenceRecord/ResearchCitation from data/evidence-registry.json

pnpm dev:mail             # maildev — a real local SMTP server + web UI at http://localhost:1080, for viewing verification/reset emails sent in dev
```

**Local Postgres:** a PostgreSQL 17 server runs locally (Windows service `postgresql-x64-17`) with a dedicated `lean_academy` login role + database (not the `postgres` superuser — that stays a separate, unshared credential). `DATABASE_URL` needs to be in **two** places: `.env` at the repo root (read by `apps/web`/`apps/api` at runtime) *and* `packages/db/.env` (the Prisma CLI only reads `.env` from its own CWD/schema directory, not the monorepo root — copy it there too if you rotate the password). Both files are gitignored; see `.env.example` for the shape. The `lean_academy` role has `CREATEDB` so `prisma migrate dev` can create its shadow database — don't revoke that or migrations will fail with `P3014`.

**`pnpm dev` needs the root `.env` too, and plain `next dev` doesn't read it** — discovered 2026-09-17 while verifying real Google OAuth credentials: `next dev`'s env loader (`@next/env`) only reads `.env*` files from its own project directory (`apps/web`), never the monorepo root, so `GOOGLE_CLIENT_ID`/`NEXTAUTH_SECRET`/`DATABASE_URL`/etc. were silently undefined (`MissingSecret`, then a generic `error=Configuration` page) even though the root `.env` had real values. This is the exact same root cause the E2E command above already works around for `next start` by inlining vars — `apps/web`'s `dev` script now does the equivalent for `next dev` via `dotenv-cli` (`"dev": "dotenv -e ../../.env -- next dev -p 3000"`, `apps/web/package.json`). The port is pinned explicitly because the root `.env` also carries `apps/api`'s `PORT=4000`, which would otherwise leak into `next dev` and silently move it off 3000.

**Single-package commands** (run inside that package, or `pnpm --filter <name> <script>` from root):

```bash
pnpm --filter @lean-academy/evidence test        # e.g. run just the evidence-registry tests
pnpm --filter @lean-academy/adaptive-engine test
cd packages/evidence && pnpm exec vitest run src/index.test.ts   # a single test file
```

**E2E tests (Playwright, `apps/web/e2e/`)** need a real server already running — they don't manage one for you (see the config's own comment for why). Prefer running them against a production build (`next build` + `next start`) over `next dev` — faster, and precompiled routes avoid the timing window behind the dev-mode CSRF gotcha below (now mitigated, but production is still the more deterministic target for tests).

```bash
cd apps/web
pnpm exec next build && DATABASE_URL="..." NEXTAUTH_SECRET="..." NEXTAUTH_URL="http://localhost:3000" AUTH_TRUST_HOST=true pnpm exec next start -p 3000 &
pnpm exec playwright test
```

**`tsc --noEmit` on `apps/web` needs Next's route types regenerated first** if you've added/removed a route since the last `next dev`/`next build` — otherwise the typed `PageProps<'/your-route'>`/`LayoutProps<...>` helpers fail with "does not satisfy the constraint 'AppRoutes'". Run `pnpm exec next typegen` (from `apps/web`) to regenerate them without a full build.

**Build order matters for apps that aren't `apps/web`.** `apps/web` transpiles workspace packages' TS source directly (via `next.config.ts`'s `transpilePackages`), but `apps/api` resolves workspace packages through their `dist/` output (their `package.json` `main`/`types` point there). Run `pnpm build` (or at least build the packages `apps/api` depends on) before `apps/api` will typecheck or run — it doesn't watch/rebuild its deps for you.

The one generated artifact outside `apps/*`/`packages/*` is `prototype/lean-academy-prototype.html`. It's produced from `prototype/*.dc.html` + `prototype/canvas.json` via the Claude Code `design` skill's seed step — don't hand-edit it directly; edit the source `.dc.html`/`canvas.json` files and reseed/republish through the `design` skill.

**Verifying interactive UI (timed exercises, forms with client-side state) needs a real browser** — build/typecheck/lint passing and server-rendered HTML looking right do not prove client-side interaction (timers, event listeners, animations) actually works. Try the Claude-in-Chrome extension first; if it won't connect, fall back to a real Playwright test in `apps/web/e2e/` (see the command above) rather than skipping verification — that's what caught the dev-mode CSRF bug above. Either way, say plainly what was and wasn't actually exercised rather than inferring success from the build (see the N-Back exercise screen's kanban entry for what honest partial-then-complete reporting looked like here).

## Architecture

### The evidence-gating chain (the project's central mechanic)

Every training exercise is traceable through linked, must-stay-in-sync artifacts:

1. `docs/evidence-review.md` — narrative literature review per training domain: evidence quality, trained-task improvement vs. near transfer vs. far transfer (kept strictly separate), studied population, limitations, citations.
2. `data/evidence-registry.json` — the machine-readable mirror (`modules[]`, each keyed by a `method` id like `adaptive-nback-v0`). Only `productionApproved: true` modules may ever load in the production exercise catalog.
3. `packages/evidence` — loads and Zod-validates the JSON (`loadEvidenceRegistry` for real Node processes like `apps/api`; `parseEvidenceRegistry` for code a frontend bundler packages — see the gotcha below) and exposes `getApprovedModules`/`isModuleApproved` as the one gate the catalog is allowed to go through.
4. `packages/db`'s `EvidenceRecord`/`ResearchCitation` Prisma models — a relational mirror kept in sync by `packages/db/prisma/seed.ts`, for querying evidence data alongside the rest of the DB (e.g. from `/science` pages once they're built). The JSON file stays the actual reviewed source of truth; this table is a synced cache, not a second place to edit evidence content.

**Adding, changing, or excluding a training method requires updating `docs/evidence-review.md` and `data/evidence-registry.json` together, in the same change**, then re-running the db seed. Two modules are deliberately `productionApproved: false` (`inhibition-flanker-gonogo-v0`, `rsvp-single-word-v0`, reviewed in `docs/evidence-review.md` §6 and §10) — don't flip these without a real literature pass.

**Gotcha:** Next.js's server bundle virtualizes `__dirname` (rewrites it to a synthetic path), which breaks naive `fs.readFileSync(__dirname + ...)` resolution. That's why `packages/evidence` is split into a pure `parseEvidenceRegistry(data)` and an fs-based `loadEvidenceRegistry(path?)` — `apps/web` imports `data/evidence-registry.json` directly (bundled as a static asset) and calls `parseEvidenceRegistry`; `apps/api` (a plain Node process, not bundled) uses `loadEvidenceRegistry`. Keep this split if you touch either function.

**Gotcha: a "use client" component cannot import even one runtime constant/function from a server-only (Prisma-importing) `lib/*.ts` module** — doing so bundles the whole module graph, including Prisma (and transitively `node:fs`), into client JS, which crashes every real page load with "Functions cannot be passed directly to Client Components" or `Cannot find module 'node:fs'`. `import type { ... }` from such a module is fine (erased at compile time); a real value import is not. Hit twice now: `ProgressView.tsx` keeps its own local copy of `near-transfer-assessment.ts`'s display labels instead of importing that module, and `LongitudinalTrendsView.tsx` (`apps/web/src/lib/trend-data.ts`) takes its `TREND_MIN_SESSIONS`/`TREND_MIN_SPAN_DAYS` as plain-number props from the server-component page instead of importing them directly. When adding a new client component that needs a constant from a server-only data module, pass it down as a prop from the nearest server component rather than importing it.

### Auth data model: `Account` *is* the Identity/AuthProvider model

`packages/db/prisma/schema.prisma` uses Auth.js's (`next-auth`) standard adapter shape — `User`/`Account`/`Session`/`VerificationToken` — rather than a bespoke `Identity` table. `Account` (one row per `(provider, providerAccountId)`) already *is* the "Identity/AuthProvider" model `project_prompt.txt` asks for: it's how a user links Google and Facebook to one account without duplicates. Email+password does not create an `Account` row — Auth.js's Credentials provider isn't an OAuth "linked account," so it uses `User.hashedPassword` directly (the standard Auth.js pattern). Auth config lives in `apps/web/src/lib/auth.ts`. Don't reintroduce a separate custom Identity table; extend `Account`/`User` instead.

**Gotcha (fixed, but the underlying race still exists) — credentials sign-in could spuriously fail under `next dev`:** `signIn()`'s own internal `getProviders()` → `getCsrfToken()` sequence can race a *separate* concurrent request to Auth.js's shared route handler that also touches the CSRF cookie, causing `MissingCSRF`. Confirmed by network trace, never reproduced under `next start` (route handlers precompiled; no timing window). `SessionProvider`'s default `refetchOnWindowFocus` was one real source of that extra request — `apps/web/src/app/providers.tsx` now disables it. That alone didn't fully close the window (an 8-run cold-start stress test still hit the race once), so `AuthForm.tsx`'s `signInWithCsrfRaceRetry` retries the credentials sign-in once on failure — safe regardless of cause, since a genuine wrong password just fails identically on retry. **Don't try to "fully" fix this by chasing every possible concurrent request** — the retry is the actual fix; the race firing occasionally under dev is expected and harmless now that it's transparently recovered. (One thing that made this *worse* when tried: pre-warming the CSRF token in a mount effect — React Strict Mode double-invokes that effect too, adding another concurrent request.)

### Email verification & password reset

`VerificationToken` (Auth.js's standard table — see above) is reused for two purposes it wasn't originally built for: email verification and password reset. The `identifier` column is prefixed by purpose (`"verify:" + email` / `"reset:" + email`) so the two flows can't be confused; tokens are stored as a SHA-256 hash (`apps/web/src/lib/tokens.ts`), never plaintext, and deleted the moment they're looked up (valid or not) — single-use by construction, not by convention. `apps/web/src/lib/email.ts` sends real SMTP mail via `nodemailer`; locally it points at `maildev` (`pnpm dev:mail`), in production at a real provider's SMTP endpoint via the same `SMTP_*` env vars — the sending code itself never changes. `/api/auth/forgot-password` always returns the same generic message regardless of whether the account exists (prevents email enumeration) and is rate-limited by `apps/web/src/lib/rate-limit.ts` (in-memory, single-instance — fine for now, not for a multi-instance deployment), as are login and register (see the rate limiter's own comment for which endpoints and limits). Password reset now invalidates sessions on other devices despite the JWT strategy having no server-side session store: it stamps `User.passwordChangedAt`, and `apps/web/src/lib/auth.ts`'s `jwt` callback rejects any token whose `iat` predates it, forcing every other device to sign out on its next request rather than waiting for natural token expiry.

### Documentation map

- `README.md` — entry point and full doc index.
- `docs/product-requirements.md` — vision, users, requirements, metrics, scientific claim limits.
- `docs/evidence-review.md` + `data/evidence-registry.json` — see above.
- `docs/ux-strategy.md` — user journeys, IA, the critical-path screen list `prototype/` implements.
- `docs/design-system.md` — tokens, typography, motion, accessibility rules; the source values live in `packages/design-system/src/tokens.ts` and must match `prototype/Styleguide.dc.html`.
- `docs/development-plan.md` — the Phase 0–10 roadmap; check this before assuming what stage of work is appropriate.
- `docs/kanban.md` — the live "what's next" board; more current than the development plan for day-to-day priority.
- `docs/scrum.md` — lightweight scrum process for this project (roles, sprint/ceremony mapping, Definition of Ready/Done); how it relates to the two files above is explained there.
- `docs/mobile-plan.md`, `docs/monetization-plan.md`, `docs/security.md`, `docs/testing.md` — later-phase plans, already drafted ahead of need.
- `env_development.md` — operator-facing guide to which Claude Code skills/subagents fit which project phase.

### Non-negotiable content rules (apply to any doc, copy, or code change)

- Never let copy claim IQ increase, general intelligence gain, dementia prevention, ADHD cure, or similar unsupported outcomes — see "SCIENTIFIC PROGRESS LANGUAGE" in `project_prompt.txt` and the Scientific Honesty section of `docs/product-requirements.md`.
- Keep trained-task gains, near transfer, and far transfer as three separate, never-conflated concepts wherever they appear (docs, data, UI copy).
- Reading-related copy or metrics must never show WPM without its paired comprehension figure alongside it.
- Difficulty is always shown to users in plain language (Beginner/Intermediate/Advanced/Expert/Custom/Auto — see `packages/shared/src/difficulty.ts`), never as the raw internal `Difficulty` number from `packages/adaptive-engine`.

### Monorepo layout

```text
apps/
  web/     Next.js 16 (App Router, Turbopack). See docs/kanban.md's Done section and docs/development-plan.md for current phase status. apps/web/e2e/accessibility.spec.ts (axe-core, plus a manual keyboard-nav check) runs against every real screen — keep it green when adding new interactive elements, and prefer real <button>/<input> elements with proper roles over div-onClick, which axe won't catch on its own but a keyboard-only user will hit immediately. Full auth flow built: /login, /signup, /verify-email, /forgot-password, /reset-password. /train/n-back, /train/complex-span, /train/spatial-sequence, and /train/reading are the four real exercises, each usable standalone or embedded in a session via the optional SessionModeProps (initialDifficulty/onComplete — see apps/web/src/lib/session-types.ts). /onboarding (goals -> time -> experience -> calibration -> recommended level) writes the first TrainingPlan/DailyGoal/DifficultyState/AssessmentResult rows; it's an opt-in link on the home page, not a mandatory post-signup redirect yet. The real Home screen (apps/web/src/app/page.tsx) shows a "Today's Training" card from apps/web/src/lib/todays-training.ts and strings that day's exercises together via /train/session (<TrainingSessionRunner>, apps/web/src/components/TrainingSessionRunner.tsx) without returning to a menu between them, persisting real Trial rows and advancing DifficultyState per exercise through /api/training-sessions/*. /progress (<ProgressView>, apps/web/src/lib/progress-data.ts) reads those same Trial/DifficultyState rows directly — a user who has only tried exercises via their standalone /train/<exercise> routes (which never persist) shows up honestly as having nothing trained yet. /progress/trends (<LongitudinalTrendsView>, apps/web/src/lib/trend-data.ts, premium-gated) shows a real multi-point time series per trained task/reading metric instead of a before/after snapshot, gated behind a fixed 5-session/14-real-day-span floor per chart so a handful of same-day sessions never draws a misleading trend line. /science (<ScienceView>, apps/web/src/lib/science-data.ts) renders directly from data/evidence-registry.json, cross-referenced against real TaskDefinition rows for which exercises are actually implemented. Playwright E2E tests live in apps/web/e2e/ (vitest is unit-only — see Commands).
  api/     Fastify. /health (includes a real DB connectivity check), /catalog (evidence-gated module list).

packages/
  db/                 Prisma schema + client singleton (see Auth data model above).
  evidence/            Evidence registry loader/validator/catalog gate.
  adaptive-engine/     RollingWindowAdaptiveEngine implementing project_prompt.txt's AdaptiveTrainingTask interface; gradual, window-based difficulty changes only.
  design-system/       Color/type/spacing tokens transcribed from prototype/Styleguide.dc.html — keep both in sync.
  shared/              Cross-cutting plain-language labels (difficulty levels, training domains).
  cognitive-engine/    NBackTask, ComplexSpanTask, and SpatialSequenceTask done (all wrap adaptive-engine; difficulty *is* N / set size / sequence length respectively). Verbal sequencing, method of loci still placeholders — follow NBackTask/ComplexSpanTask/SpatialSequenceTask's pattern: task-specific stimulus/scoring logic here, difficulty adaptation delegated to adaptive-engine, never reimplemented.
  reading-engine/      PacedReadingTask (wraps adaptive-engine; difficulty *is* target WPM), a 5-passage bank with comprehension questions, and the Reading Efficiency Score (comprehension floor 0.70, sourced from Betts 1946's Informal Reading Inventory convention — see docs/evidence-review.md §8).
  trial-engine/        Placeholder — shared stimulus/timing runtime (performance.now(), focus-loss detection).
  psychometrics/       Placeholder — accepted psychometric calculations (d-prime, span scoring, etc.).
```

Every `packages/*` has `build`/`typecheck`/`test`/`lint` scripts (`test` uses `--passWithNoTests` on the still-empty placeholders, so `pnpm test` at the root stays green — replace that flag once a package gets its first test file rather than leaving it there out of habit).

### Design tokens in `apps/web`

`apps/web/src/app/globals.css` defines the same tokens as `packages/design-system/src/tokens.ts` / `prototype/Styleguide.dc.html` as plain CSS custom properties (light in `:root`, dark under `@media (prefers-color-scheme: dark)`), then re-exposes them to Tailwind v4 via `@theme inline` — so `bg-accent`, `text-text-2`, `rounded-lg`, `font-display`, etc. are real Tailwind utilities that resolve to our actual palette, not Tailwind's defaults. Fonts (Sora/Manrope) are loaded via `next/font/google` in `layout.tsx` and exposed the same way. This is a third place the tokens now live — keep it in sync with the other two when the palette changes. There's no manual light/dark toggle in the app (unlike the prototype, which has one per screen for design review); the real app follows system preference only, for now.

`apps/web/src/components/AuthForm.tsx` is the first real screen component (used by both `/login` and `/signup`) — it's the pattern to follow for the rest: read the matching `prototype/*.dc.html` for exact copy/layout/states, then rebuild with Tailwind utilities against these tokens rather than inline styles.

**Auth.js host trust:** requests get rejected with `UntrustedHost` unless `AUTH_TRUST_HOST=true` is set — `next dev` trusts automatically, but `next start` (production mode, including local testing of a production build) and most self-hosted deployments behind a reverse proxy don't. It's in `.env`/`.env.example`; don't remove it when testing a production build locally.

**Google OAuth callback fails with `response parameter "iss" (issuer) missing`:** discovered 2026-09-17 verifying real Google credentials end-to-end. Google's own OIDC discovery document (`https://accounts.google.com/.well-known/openid-configuration`) advertises `authorization_response_iss_parameter_supported: true` (RFC 9207), but its actual authorization redirect doesn't include an `iss` param — `oauth4webapi`'s response validation (used internally by `@auth/core`) takes the discovery doc at its word and rejects every real callback. Fixed in `apps/web/src/lib/auth.ts` by giving the `Google` provider explicit `authorization`/`token`/`userinfo` endpoint URLs (Google's own long-stable OAuth2 endpoints), which skips OIDC discovery entirely — `@auth/core` only fetches discovery metadata when those URLs are absent. Confirmed by network trace that this is genuinely Google's inconsistency, not ours: an identical request briefly succeeded once (reached our callback and only then hit the `iss` error), so the client/secret/redirect-URI wiring itself was never the problem. **Separately, immediately after creating a new Google OAuth client, expect `Error 401: invalid_client` (`The OAuth client was not found`) to fire intermittently for a while** — Google's own docs warn credential changes can take "5 minutes to a few hours" to propagate; this resolved intermittently rather than monotonically in testing (one success, then several consecutive failures ~40 minutes after creation), so don't read a single success as "fixed" or a later failure as a regression — just retry later. The Phase 2 "Verify the real Google/Facebook OAuth redirect" kanban card is not yet closed out for this reason — the code-level fix is verified, but a full sign-in-to-session round trip in a real browser still needs to be confirmed once Google's propagation settles.

### `prototype/` (design canvas)

Self-contained `*.dc.html` "Design Component" artboards — one per screen — plus `canvas.json` (the layout manifest) and the generated `lean-academy-prototype.html`. Each `.dc.html` file is fully independent: no shared runtime state or stylesheet between artboards, so a token/component change has to be applied by hand everywhere it's used (grep the CSS variable or class name across `prototype/*.dc.html`). This is the approved visual reference — build `apps/web`'s real screens to match it, don't redesign from scratch.
