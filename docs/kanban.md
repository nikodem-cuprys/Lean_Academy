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

## Ready (Phase 2 — Technical Foundation) — first executable batch

```text
Title: Repository & Monorepo Scaffold
Epic: Infrastructure
Priority: P0
Description: Initialize the actual codebase per the reference architecture in docs/development-plan.md (apps/web, apps/api, packages/{cognitive-engine,reading-engine,trial-engine,adaptive-engine,psychometrics,evidence,design-system,shared}). Confirm Next.js/TS/Tailwind stack or document a justified deviation.
Acceptance criteria:
- git repo initialized
- monorepo tooling chosen and configured (workspaces)
- apps/web boots to a blank page
- packages/evidence exposes a typed loader for data/evidence-registry.json
Dependencies: none (first Phase 2 card)
Complexity: M
Owner: Senior Full-Stack Engineer
Status: Backlog (Ready once Phase 1 prototype/usability pass is at least directionally validated)
```

```text
Title: Database Schema v0
Epic: Infrastructure
Priority: P0
Description: Design and migrate the normalized Postgres schema for the entities listed in project_prompt.txt's DATABASE section (User, Identity, Subscription, TrainingPlan, TrainingSession, TaskDefinition, TaskVersion, Trial, DifficultyState, Assessment, AssessmentResult, ReadingPassage, ReadingQuestion, ReadingResult, Achievement, UserAchievement, DailyGoal, Streak, Challenge, EvidenceRecord, ResearchCitation, Device, NotificationPreference).
Acceptance criteria:
- schema covers every entity in the spec's list
- TaskVersion relationship prevents mixing scores across incompatible task versions
- migrations run cleanly from empty database
Dependencies: Repository & Monorepo Scaffold
Complexity: L
Owner: Data Engineer
Status: Backlog
```

```text
Title: Authentication (Email + Google + Facebook)
Epic: Authentication
Priority: P0
Description: Email+password with verification and reset flow, plus Google and Facebook OAuth/OIDC via PKCE. Identity/AuthProvider model supports account linking without duplicate accounts.
Acceptance criteria:
- register, verify email, log in, reset password all work
- Google and Facebook "Continue with" flows use official OAuth, never ask for provider passwords
- a user who signs up with email can later link Google/Facebook to the same account
- secrets never exposed to frontend code
Dependencies: Database Schema v0
Complexity: L
Owner: Senior Full-Stack Engineer / Security Engineer
Status: Backlog
```

```text
Title: Adaptive Engine Skeleton
Epic: Adaptive Engine
Priority: P0
Description: Implement the shared AdaptiveTrainingTask interface (getCurrentDifficulty, recordTrial, calculatePerformance, recommendNextDifficulty) with rolling-window difficulty adjustment, in packages/adaptive-engine, with no real exercise wired in yet (test against a synthetic task).
Acceptance criteria:
- interface matches project_prompt.txt's ADAPTIVE TRAINING ENGINE spec
- difficulty changes gradually across a rolling window, never on a single trial
- unit tests cover the adaptation curve against synthetic trial sequences
Dependencies: Repository & Monorepo Scaffold
Complexity: M
Owner: Senior Full-Stack Engineer / Psychometrics Specialist
Status: Backlog
```

```text
Title: Evidence Registry Loader & Catalog Gate
Epic: Science/Evidence
Priority: P0
Description: packages/evidence loads and validates data/evidence-registry.json (schema-checked with Zod) and exposes the set of productionApproved module ids; the exercise catalog can only ever load modules present in that approved set.
Acceptance criteria:
- malformed or missing registry entries fail loudly at build/boot, not silently
- catalog loader has a test proving a non-approved module id cannot be loaded
- /science pages render directly from this loader (no separate hand-maintained copy of the data)
Dependencies: Repository & Monorepo Scaffold
Complexity: S
Owner: Data Engineer
Status: Backlog
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
