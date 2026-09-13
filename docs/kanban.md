# Kanban — LeanAcademy

_Companion to `docs/development-plan.md`. Columns: Backlog · Research · UX/Design · Ready · In Progress · Review · Testing · Done. This file is the live source of truth for "what's next" — keep it current rather than letting `docs/development-plan.md` (which is phase-level) go stale as a substitute._

## Epics

`Research` · `Design System` · `Onboarding` · `Authentication` · `Working Memory` · `Reading Training` · `Adaptive Engine` · `Daily Training` · `Progress` · `Gamification` · `Science/Evidence` · `Payments` · `Mobile Foundation` · `iOS` · `Android` · `Analytics` · `Infrastructure` · `Testing`

## Board

### Done

- **[Research] Literature review pass 1** — WM updating, complex span, visuospatial WM, verbal WM, cognitive control, reading efficiency, memory strategies. Owner: Cognitive Scientist. Output: `docs/evidence-review.md`, `data/evidence-registry.json`.
- **[Research] Evidence registry v0** — machine-readable registry gating the exercise catalog. Owner: Data Engineer / Psychometrics Specialist. Output: `data/evidence-registry.json`.
- **[Research] Product Requirements Document v0** — Owner: Product Manager. Output: `docs/product-requirements.md`.
- **[Design System] UX strategy + journey map v0** — 14 core screens, IA, critical path. Owner: UX Researcher / Senior UI/UX Designer. Output: `docs/ux-strategy.md`.
- **[Design System] Design system v0 (tokens/typography/components/motion/a11y)** — Owner: Senior UI/UX Designer / Product Designer. Output: `docs/design-system.md`.
- **[Infrastructure] Development plan + phased roadmap** — Owner: Product Manager. Output: `docs/development-plan.md`.
- **[Infrastructure] Kanban board** — this file.
- **[Mobile Foundation] Mobile plan v0** — Owner: Mobile Engineer. Output: `docs/mobile-plan.md`.
- **[Payments] Monetization plan v0** — Owner: Monetization Strategist. Output: `docs/monetization-plan.md`.
- **[Infrastructure] Security plan v0** — Owner: Security Engineer. Output: `docs/security.md`.
- **[Testing] Test strategy v0** — Owner: QA Engineer. Output: `docs/testing.md`.
- **[Infrastructure] Repository & Monorepo Scaffold** — pnpm workspaces (`apps/{web,api}` + 8 `packages/*`). apps/web (Next.js 16, App Router) boots and renders real evidence-registry + auth-session data; apps/api (Fastify) serves `/health` and `/catalog`. `pnpm build`/`typecheck`/`test`/`lint` all pass at the repo root. Owner: Senior Full-Stack Engineer. See CLAUDE.md's Commands section for the real commands this unblocked.
- **[Infrastructure] Database Schema v0** — Prisma schema in `packages/db/prisma/schema.prisma` covering every entity in `project_prompt.txt`'s DATABASE section. Two justified deviations: (1) `User`/`Account`/`Session`/`VerificationToken` follow Auth.js's standard adapter shape rather than a bespoke `Identity` table — `Account` already *is* the per-provider "Identity/AuthProvider" model the spec asked for, and reusing Auth.js's schema means the OAuth/PKCE code path is library-tested, not hand-rolled; (2) added `ChallengeProgress` as the join table normalization requires (not in the spec's literal entity list). Owner: Data Engineer.
- **[Science/Evidence] Evidence Registry Loader & Catalog Gate** — `packages/evidence` (Zod-validated, throws loudly on malformed/missing data). Split into `parseEvidenceRegistry` (pure, bundler-safe) and `loadEvidenceRegistry` (fs-based, Node-only) after discovering Next.js's server bundle virtualizes `__dirname`, which broke naive fs reads from bundled code — apps/web imports the JSON directly and parses it; apps/api reads it from disk. 9 tests, including one proving a non-approved module id is rejected. Owner: Data Engineer.
- **[Adaptive Engine] Adaptive Engine Skeleton** — `packages/adaptive-engine`'s `RollingWindowAdaptiveEngine` implements the exact `AdaptiveTrainingTask` interface from `project_prompt.txt`. 10 tests, including ones proving no single-trial difficulty swings and correct min/max clamping. Not yet wired to a real exercise (that's `packages/cognitive-engine`'s job, still a placeholder). Owner: Senior Full-Stack Engineer / Psychometrics Specialist.
- **[Infrastructure] Run the first real Prisma migration** — a local PostgreSQL 17 server (already installed, Windows service) now backs local dev: a dedicated `lean_academy` login role + database were created (not the `postgres` superuser), `pnpm db:migrate` applied migration `20260913190003_init` cleanly, and `pnpm --filter @lean-academy/db seed` synced all 10 evidence records. `apps/api`'s `/health` now does a real `SELECT 1` through Prisma and reports `{"status":"ok","db":"connected"}`. Credentials live in `.env` (repo root) and `packages/db/.env` (Prisma CLI doesn't read the root one — see CLAUDE.md) — both gitignored, neither committed. Owner: Data Engineer.
- **[Authentication] Auth: login/signup UI** — `/login` and `/signup` in `apps/web`, built as a shared `<AuthForm>` client component matching `prototype/Login.dc.html` (tab toggle, OAuth buttons, divider, fields, all styled from real design tokens now wired into `apps/web`'s Tailwind theme via `globals.css`). Verified against the real DB, not just rendered: registered a test user through `POST /api/auth/register`, confirmed a wrong password is rejected and the correct one succeeds and sets a session cookie (replicated the CSRF+cookie dance `next-auth/react`'s `signIn()` does internally), confirmed duplicate-email registration returns 409, then deleted the test user. Google/Facebook buttons call `signIn()` correctly but the actual OAuth redirect is unverified — there are no real OAuth app credentials configured (`GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID` are still blank in `.env`), so don't treat that path as proven yet. Also discovered and documented: Auth.js rejects requests with `UntrustedHost` under `next start`/production mode unless `AUTH_TRUST_HOST=true` is set (`next dev` trusts automatically) — added to `.env`/`.env.example`. Email verification and password reset remain separately tracked below (not part of this card). Owner: Senior Full-Stack Engineer / Senior UI/UX Designer.
- **[Authentication] Auth: email verification + password reset delivery** — real SMTP delivery via `nodemailer`, not a console.log stand-in: locally it sends to `maildev` (`pnpm dev:mail`, a genuine local SMTP server + web UI at `http://localhost:1080` — see `CLAUDE.md`), and the same code points at a real transactional provider in production via the same `SMTP_*` env vars. Reuses Auth.js's `VerificationToken` table for both flows (`apps/web/src/lib/tokens.ts`), with the identifier prefixed by purpose (`verify:`/`reset:` + email) so they can't collide; tokens are stored as a SHA-256 hash, never plaintext, and deleted on first use. New routes: `/verify-email` (server component, verifies on render), `/forgot-password` + `/reset-password` (forms), plus `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`. `forgot-password` always returns the same generic message regardless of whether the account exists or has a password at all, to prevent email enumeration, and is rate-limited (3 requests / 15 min per email) via a new minimal in-memory limiter (`apps/web/src/lib/rate-limit.ts` — single-instance only, not the full rate-limiting requirement from `docs/security.md`, which still needs a shared store for login/register). Verified against the real DB and real SMTP end to end, not just rendered: registered a user, fetched the actual email from maildev's API, followed the real verification link (`emailVerified` got set, token deleted, reusing the same link correctly failed), requested a password reset for both a real and a nonexistent email (identical response, only one email actually sent), used the real reset link to change the password (old password then rejected, new one accepted), confirmed reusing the reset link fails, and confirmed the rate limiter caps repeated requests. One known, documented gap: sessions use the JWT strategy, so a password reset does not invalidate sessions already issued on other devices — closing that would need database sessions or a revocation list. Owner: Senior Full-Stack Engineer / Security Engineer.
- **[Working Memory] Adaptive N-Back exercise logic** — `packages/cognitive-engine`'s `NBackTask` (visual/spatial 3x3-grid n-back, wrapping `RollingWindowAdaptiveEngine` — difficulty *is* N here, it owns no adaptation logic of its own). 8 tests: warm-up trials (first N stimuli) correctly excluded from scoring, all four signal-detection classifications (hit/miss/falseAlarm/correctRejection) traced through by hand with a deterministic injected `random`, difficulty confirmed unchanged after a single trial and stepping down by exactly one after a full window of misses (proving it defers to the existing engine rather than reimplementing adjustment), a statistical check that the observed match rate lands within tolerance of the theoretical rate (forced + incidental matches), and a grid-bounds check over 500 trials. Owner: Senior Full-Stack Engineer / Psychometrics Specialist.
- **[Working Memory] N-Back exercise screen (apps/web)** — `/train/n-back`, auth-gated, `<NBackExercise>` running a real 20-trial session against `NBackTask` with `performance.now()`-based stimulus/response timing, a `visibilitychange` listener that excludes an interrupted trial from scoring entirely (not just flags it), and a results screen with honest per-outcome copy (level-up/level-down/held-steady framed as adaptive-engine behavior, never as an ability claim). Two deliberate departures from `prototype/Exercise.dc.html`, both explained in the component's own header comment: the "Exercise 1 of 3" dots became a real "Trial N of 20" progress bar (no multi-exercise session exists yet to make dots honest), and the domain tag was corrected from the prototype's "SPATIAL SEQUENCE" label to "N-BACK" (matching what the task actually is). **Now verified in a real Chromium browser**, not just server-rendered HTML: added `apps/web/e2e/n-back.spec.ts` (Playwright — the E2E tool `docs/testing.md`/`project_prompt.txt` already call for; the Claude-in-Chrome extension still wasn't connecting, so this was the alternative). The test signs up a fresh user, plays a full 20-trial run by actually clicking the response button each trial (Playwright's auto-waiting click naturally paces itself to the button's real disabled/enabled cycle), and asserts the results screen. It caught a real, if narrow, finding along the way — see the new Backlog item on dev-mode CSRF — and confirmed the adaptive engine genuinely responds live in-browser: an "always answer match" bot strategy is wrong on the ~62% of trials that aren't matches, and the run correctly ended with difficulty stepped down and copy framed as "eased back... to keep this challenging but doable," not a failure message. Owner: Senior Full-Stack Engineer / Senior UI/UX Designer.

### Backlog (Phase 3+ and beyond — not yet Ready)

- **[Working Memory] Flanker/Go-No-Go cognitive-control module** — Blocked on stronger transfer evidence; see evidence review §6. Do not promote to Ready until evidence level improves or framing is re-scoped to strictly within-task.
- **[Reading Training] Skimming training module** — Needs its own research pass (tracked in `docs/evidence-review.md` "Next research pass").
- **[Reading Training] Reading flexibility training (pace-matches-purpose)** — Needs its own research pass.
- **[Gamification] Full XP/achievements/weekly-challenges system** — Correctly sequenced after Phase 3/4 per development plan.
- **[Payments] Stripe integration + entitlement system** — Correctly sequenced after Phase 3.
- **[Mobile Foundation] React Native/Expo vs Flutter spike** — Correctly sequenced after Web MVP validation (Phase 8).
- **[iOS] / [Android] app shells** — Blocked on Mobile Foundation.
- **[Analytics] Full product + scientific analytics pipeline** — Needs schema design once real usage exists to instrument.
- **[Authentication] Verify the real Google/Facebook OAuth redirect** — needs real OAuth app credentials (`GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID` etc. in `.env`) registered with each provider; everything up to that point is implemented and code-reviewed but the actual redirect/callback round-trip has never been exercised.
- **[Infrastructure] Broaden rate limiting beyond forgot-password/reset-password** — `docs/security.md` calls for rate limiting on login and register too; only the two newest endpoints have it (`apps/web/src/lib/rate-limit.ts`), and even that's in-memory/single-instance only — a real deployment needs a shared store (Redis, etc.).
- **[Authentication] Investigate: credentials sign-in can fail right after registration under `next dev`** — found while writing the N-Back E2E test. In dev mode only (never reproduced under `next start`, which is what's been used for every other auth verification in this project), the browser sometimes fires two `GET /api/auth/csrf` requests back to back — almost certainly React Strict Mode double-invoking a client-side setup effect, which is dev-only behavior — leaving next-auth's client with a stale cached CSRF token that no longer matches the cookie, and Auth.js then rejects the sign-in with `MissingCSRF`. Production builds are unaffected (extensively verified). Worth a real fix — e.g. checking whether a newer `next-auth`/`@auth/core` version handles this, or whether `reactStrictMode: false` in `next.config.ts` is an acceptable trade-off — since this currently means a developer using the documented `pnpm dev` workflow could hit a confusing false failure signing up.
- **[Authentication] Invalidate other sessions on password reset** — sessions use the JWT strategy, so resetting a password doesn't revoke sessions already issued on other devices. Needs database sessions or a token-revocation list.

---

## Ready — next executable batch (Phase 3 — Web MVP kickoff)

Empty right now — see the N-Back exercise screen's Done entry above for one important caveat (client-side interaction unverified in a real browser) before picking the next card.

## Backlog — rest of Phase 3 (not yet Ready; sequenced after the N-Back slice above)

- **[Working Memory] Complex Span exercise logic + screen** — second MVP exercise per the priority trim; mirror the N-Back cards' structure (engine logic in packages/cognitive-engine first, screen against prototype/ExerciseComplexSpan.dc.html second).
- **[Working Memory] Spatial Sequence Recall exercise logic + screen** — third MVP exercise; screen against prototype/ExerciseSpatial.dc.html.
- **[Reading Training] Reading baseline + paced/adaptive reading exercise** — packages/reading-engine logic (WPM + comprehension pairing, Reading Efficiency Score with a literature-derived comprehension floor — do not hardcode one without checking docs/evidence-review.md §8 first) plus a screen against prototype/ExerciseReading.dc.html.
- **[Onboarding] Baseline/calibration flow** — prototype/Baseline.dc.html, OnboardingGoals/Onboarding/OnboardingExperience.dc.html; produces the initial per-user DifficultyState rows and TrainingPlan.
- **[Daily Training] Session orchestration** — strings exercises together without returning to a menu between them (Home -> Exercise -> transition -> Exercise -> ... -> Session Complete), per prototype/Home.dc.html and SessionComplete.dc.html. Depends on at least two exercise screens existing.
- **[Progress] Progress page v0** — prototype/Progress.dc.html; Trained Tasks / Similar Cognitive Tasks / Broader Transfer sections, reads real Trial/ReadingResult data once it exists.
- **[Science/Evidence] Science page v0** — prototype/Science.dc.html; renders directly from packages/evidence's registry loader (per the Evidence Registry Loader & Catalog Gate card's Done note — no separate hand-maintained copy).

Three small Phase 2 loose ends (OAuth redirect unverified, rate limiting not broadened, no session invalidation on password reset) remain tracked further down and don't block any of the above.

---

## Card template

```text
Title:
Epic:
Priority: P0 | P1 | P2 | P3
Description:
Acceptance criteria:
- ...
Dependencies:
Complexity: XS | S | M | L | XL
Owner:
Status: Backlog | Research | UX/Design | Ready | In Progress | Review | Testing | Done
```

Priority definitions: **P0** essential (blocks the current phase's exit criteria) · **P1** high value · **P2** valuable · **P3** later. Every P0/P1 card must name real acceptance criteria and real dependencies — no "Build frontend"-style cards.
