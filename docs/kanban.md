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
- **[Infrastructure] Database Schema v0** — Prisma schema in `packages/db/prisma/schema.prisma` covering every entity in `project_prompt.txt`'s DATABASE section. Two justified deviations: (1) `User`/`Account`/`Session`/`VerificationToken` follow Auth.js's standard adapter shape rather than a bespoke `Identity` table — `Account` already *is* the per-provider "Identity/AuthProvider" model the spec asked for, and reusing Auth.js's schema means the OAuth/PKCE code path is library-tested, not hand-rolled; (2) added `ChallengeProgress` as the join table normalization requires (not in the spec's literal entity list). Migrations not yet run against a live Postgres instance — do that (`pnpm db:migrate`) before this is truly done; schema is verified via `prisma generate`, not yet via a real migration. Owner: Data Engineer.
- **[Science/Evidence] Evidence Registry Loader & Catalog Gate** — `packages/evidence` (Zod-validated, throws loudly on malformed/missing data). Split into `parseEvidenceRegistry` (pure, bundler-safe) and `loadEvidenceRegistry` (fs-based, Node-only) after discovering Next.js's server bundle virtualizes `__dirname`, which broke naive fs reads from bundled code — apps/web imports the JSON directly and parses it; apps/api reads it from disk. 9 tests, including one proving a non-approved module id is rejected. Owner: Data Engineer.
- **[Adaptive Engine] Adaptive Engine Skeleton** — `packages/adaptive-engine`'s `RollingWindowAdaptiveEngine` implements the exact `AdaptiveTrainingTask` interface from `project_prompt.txt`. 10 tests, including ones proving no single-trial difficulty swings and correct min/max clamping. Not yet wired to a real exercise (that's `packages/cognitive-engine`'s job, still a placeholder). Owner: Senior Full-Stack Engineer / Psychometrics Specialist.

### In Progress

```text
Title: Authentication (Email + Google + Facebook)
Epic: Authentication
Priority: P0
Description: Email+password with verification and reset flow, plus Google and Facebook OAuth/OIDC via PKCE. Account model (Auth.js standard shape, see Database Schema v0's Done note) supports account linking without duplicate accounts.
Acceptance criteria:
- [x] Google and Facebook "Continue with" flows use official OAuth (Auth.js providers), never ask for provider passwords
- [x] a user who signs up with email can later link Google/Facebook to the same account (Auth.js Account model, unique on [provider, providerAccountId])
- [x] secrets never exposed to frontend code (server-only env vars, read in src/lib/auth.ts)
- [x] register (POST /api/auth/register: validates, hashes with bcrypt, creates User) and log in (Credentials provider, bcrypt compare) work
- [ ] verify email — no email delivery is wired up yet; accounts are created with emailVerified unset. Do not fake this by marking it done.
- [ ] reset password — no reset-request/consume flow built yet
- [ ] real login/signup UI — apps/web currently has no form, only the API routes; prototype/Login.dc.html is the approved design to implement against
Dependencies: Database Schema v0 (done)
Complexity: L
Owner: Senior Full-Stack Engineer / Security Engineer
Status: In Progress — backend/config done, UI + email delivery remain (see Ready below for the split-out follow-up cards)
```

### Backlog (Phase 3+ and beyond — not yet Ready)

- **[Working Memory] Flanker/Go-No-Go cognitive-control module** — Blocked on stronger transfer evidence; see evidence review §6. Do not promote to Ready until evidence level improves or framing is re-scoped to strictly within-task.
- **[Reading Training] Skimming training module** — Needs its own research pass (tracked in `docs/evidence-review.md` "Next research pass").
- **[Reading Training] Reading flexibility training (pace-matches-purpose)** — Needs its own research pass.
- **[Gamification] Full XP/achievements/weekly-challenges system** — Correctly sequenced after Phase 3/4 per development plan.
- **[Payments] Stripe integration + entitlement system** — Correctly sequenced after Phase 3.
- **[Mobile Foundation] React Native/Expo vs Flutter spike** — Correctly sequenced after Web MVP validation (Phase 8).
- **[iOS] / [Android] app shells** — Blocked on Mobile Foundation.
- **[Analytics] Full product + scientific analytics pipeline** — Needs schema design once real usage exists to instrument.

---

## Ready — next executable batch

```text
Title: Run the first real Prisma migration
Epic: Infrastructure
Priority: P0
Description: Database Schema v0's schema.prisma is written and prisma generate succeeds, but no migration has run against a real Postgres instance yet (none was available in the scaffolding environment). Stand up a dev Postgres (local or hosted), set DATABASE_URL, and run the first migration.
Acceptance criteria:
- pnpm db:migrate runs cleanly from an empty database
- pnpm --filter @lean-academy/db seed populates EvidenceRecord/ResearchCitation from data/evidence-registry.json without error
- a basic smoke query (e.g. count Users) succeeds from apps/api
Dependencies: Database Schema v0 (done)
Complexity: S
Owner: Data Engineer
Status: Ready
```

```text
Title: Auth: login/signup UI
Epic: Authentication
Priority: P0
Description: Implement the actual /login and /signup pages in apps/web against the approved design in prototype/Login.dc.html (email/password fields, Continue with Google, Continue with Facebook, the login/signup tab toggle), wired to the existing Credentials/OAuth providers in src/lib/auth.ts and the POST /api/auth/register route.
Acceptance criteria:
- visually matches prototype/Login.dc.html (tokens from packages/design-system)
- all three sign-in paths (email, Google, Facebook) work end to end against a real DB
- form validation errors are shown inline, not just thrown as raw API errors
Dependencies: Run the first real Prisma migration
Complexity: M
Owner: Senior Full-Stack Engineer / Senior UI/UX Designer
Status: Ready
```

```text
Title: Auth: email verification + password reset delivery
Epic: Authentication
Priority: P0
Description: Wire up real email delivery (a transactional email provider — evaluate at implementation time) for the VerificationToken flow already modeled in packages/db/prisma/schema.prisma: verification-on-signup and forgot-password. Nothing here should be faked with a console.log stand-in once this card is marked Done.
Acceptance criteria:
- signup sends a real verification email; clicking the link sets User.emailVerified
- "forgot password" sends a reset link; using it updates hashedPassword and invalidates the token
- tokens expire and are single-use
Dependencies: Run the first real Prisma migration
Complexity: M
Owner: Senior Full-Stack Engineer / Security Engineer
Status: Ready
```

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
