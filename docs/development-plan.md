# Development Plan — LeanAcademy

_Phased roadmap per `project_prompt.txt`. Sizes use T-shirt estimates (XS/S/M/L/XL) since developer capacity is unknown — translate to a schedule once team size is known. Each phase lists Objective / Deliverables / Exit Criteria / Dependencies._

_Process (roles, sprint/ceremony definitions, Definition of Ready/Done) lives in `docs/scrum.md`, not here — this file stays phase-level._

## Sizing legend

XS = hours, S = ~1 day, M = ~2-4 days, L = ~1-2 weeks, XL = ~3+ weeks, all assuming one full-time senior generalist engineer; adjust down with more people, up with less focus time.

---

## Phase 0 — Research

**Objective:** Ground every training method in real evidence before any of it becomes a feature.
**Deliverables:** `docs/evidence-review.md`, `data/evidence-registry.json`, competitor analysis, this document, `docs/kanban.md`, `docs/product-requirements.md`.
**Exit criteria:** Every candidate training domain has a documented evidence-scale rating and an explicit include/exclude decision.
**Dependencies:** None.
**Size:** M (first pass complete this session; ongoing refinement is continuous, not a one-time gate).
**Status:** First pass complete — see `docs/evidence-review.md`. Follow-up items tracked at the bottom of that file (task-switching deep dive, skimming/scanning research, 2026 replication check).

## Phase 1 — UX Foundation

**Objective:** Validate the experience before building a large exercise catalog.
**Deliverables:** User journeys, information architecture, wireframes (`docs/ux-strategy.md`), design system (`docs/design-system.md`), an interactive prototype, usability-test results.
**Exit criteria:** The critical path (Landing → first exercise) has been prototyped and walked through against the usability-testing scenarios in `docs/ux-strategy.md`; no scenario requires unassisted-user instructions to complete.
**Dependencies:** Phase 0 (need to know what exercises exist to design their screens).
**Size:** L (docs done this session; interactive prototype + usability pass is separate follow-up work, ideally via the `design` skill — see `env_development.md`).
**Status:** Docs and interactive prototype both done — see `docs/ux-strategy.md` and `prototype/` (multi-artboard Design Component canvas, including dark mode and desktop/website screens). A dedicated usability-testing pass against real users has not happened; screens have instead been validated implicitly by building real, working `apps/web` UI against the prototype and verifying it in a browser (see Phase 3's status below). Doesn't block Phase 3 work.

## Phase 2 — Technical Foundation

**Objective:** Stand up the repository, database, auth, API, and shared engines the whole product depends on.
**Deliverables:** Repo scaffold (`apps/web`, `apps/api`, `packages/*` per the architecture sketch below), Postgres schema, auth (email + Google + Facebook via OAuth/PKCE), trial engine, adaptive engine skeleton, evidence-registry loader, base analytics events.
**Exit criteria:** A user can register, log in via all three methods, and the app reads the evidence registry to decide what's in the catalog (even with zero real exercises yet).
**Dependencies:** Phase 1 (screens/IA inform API/data shape); Phase 0 (registry shape).
**Size:** L.
**Status:** Complete for MVP purposes. Repo scaffold, Postgres schema + first migration, evidence-registry loader, adaptive-engine skeleton, and the full auth flow (register/login, login/signup UI, real email verification + password reset delivery) are all done and verified against a real database and real SMTP. Three small, honestly-tracked loose ends remain in `docs/kanban.md`'s Backlog (OAuth redirect unverified without real provider credentials, rate limiting not yet broadened to every auth endpoint, no session invalidation on password reset) — none block starting Phase 3.

## Phase 3 — Web MVP

**Objective:** Ship the smallest version of the real product: a handful of outstanding exercises plus reading training, end to end.
**Deliverables:** `adaptive-nback-v0`, `complex-span-v0`, `visuospatial-sequence-recall-v0`, `verbal-sequencing-v0` (or a trimmed subset — see MVP Philosophy below), `reading-paced-adaptive-v0` with baseline/calibration, daily session flow, basic progress view, `/science` pages.
**Exit criteria:** Matches the WEB SUCCESS CRITERIA in `project_prompt.txt` — account creation, all three auth methods, fast onboarding, intuitive level selection, evidence-supported WM exercises, reading-efficiency training with adaptive difficulty, daily training, understandable progress, science pages, multi-day return capability, legitimate achievements (if Phase 5 pulled forward for one), works on desktop and mobile browsers.
**Dependencies:** Phase 2.
**Size:** XL.
**Status:** Every card `docs/kanban.md` sequenced for this phase is done and browser-verified: four exercises (Adaptive N-Back, Complex Span, Spatial Sequence Recall, Paced Reading), the Baseline/calibration onboarding flow, Session orchestration (the real Home screen + stringing exercises together + real Trial/DifficultyState persistence), the Progress page, and the Science page — see `docs/kanban.md`'s Done section for what was verified and how. `verbal-sequencing-v0` remains in this phase's Deliverables list above as a nominal 5th exercise but was never picked up as a kanban card — the "or a trimmed subset" wording already anticipated cutting it; treat Phase 3 as functionally complete against the WEB SUCCESS CRITERIA rather than blocked on it, and pick it up explicitly (as a new kanban card) if it turns out to still be wanted before moving fully into Phase 4.

## Phase 4 — UX Polish

**Objective:** Take the MVP from functional to premium.
**Deliverables:** Animation pass, feedback pass, onboarding refinement from real usage, accessibility audit, mobile-responsive-web pass, performance optimization, a second usability-testing round.
**Exit criteria:** New-user 3-second screen-comprehension bar met on every core screen; Core Web Vitals-equivalent performance targets met (see `docs/testing.md` for how these get verified).
**Dependencies:** Phase 3.
**Size:** L.
**Status:** Every actionable Phase 4 card is done — accessibility audit, the mobile-responsive-web pass, the animation/feedback pass, and performance optimization; see `docs/kanban.md`'s Done section for what each one actually found (real bugs in the first and last of those four; the responsive and animation passes' investigations came back clean or honestly-disproven rather than needing fixes). Only onboarding refinement from real usage and the second usability-testing round remain, and both are genuinely blocked on inputs that don't exist yet (real users), not just unscheduled — see `docs/kanban.md` for details. Phase 4 is otherwise complete.

## Phase 5 — Engagement

**Objective:** Make the daily habit sticky, honestly.
**Deliverables:** Daily activity system, streaks (with protection, non-manipulative copy), XP (with anti-grind caps), training levels (explicitly not framed as cognitive ability), achievements, weekly challenges, personal bests.
**Exit criteria:** Every gamification element maps to a real action or real performance; none implies a cognitive-ability claim (spot-checked against `SCIENTIFIC PROGRESS LANGUAGE` in `project_prompt.txt`).
**Dependencies:** Phase 3/4 (needs real training data to gamify).
**Size:** L.
**Status:** Complete — all five Phase 5 cards (Streaks, Achievements, XP + Training Level, Personal Bests, Weekly Challenges) are done; see `docs/kanban.md`'s Done section for each one's real acceptance criteria and verification. A real `Streak` row updates on every completed `TrainingSession` with a genuine freeze-based protection mechanic; all 11 real achievements from `prototype/Achievements.dc.html` are seeded and awarded from real completion events; a real `XpEntry` ledger awards XP for completing training, consistency, trying new domains, and genuine milestones, with a real 150-XP/day anti-grind cap and a documented Training Level formula shown on Home; a real per-task Personal Best view (computed at query time, no new table) shows on the Progress page and Session Complete, using the real Reading Efficiency Score for reading rather than a raw-pace comparison; and real weekly `Challenge`/`ChallengeProgress` rows are generated and updated from `project_prompt.txt`'s own 5 example challenges, with a genuine fix along the way — Achievements' previously-hardcoded weekly-session placeholder (5) now shares one real target (4) with the new "complete N sessions" challenge instead of silently disagreeing with it. Verified end-to-end in `apps/web/e2e/streaks.spec.ts`, `apps/web/e2e/achievements.spec.ts`, `apps/web/e2e/xp.spec.ts`, `apps/web/e2e/personal-bests.spec.ts`, and `apps/web/e2e/weekly-challenges.spec.ts`. Leagues/social features remain explicitly out of scope per `project_prompt.txt`'s "optional later-stage feature" framing.

## Phase 6 — Advanced Measurement

**Objective:** Separate practiced-task improvement from genuine transfer with more rigor.
**Deliverables:** Transfer assessments (different tasks/forms than training), alternate forms to avoid pure practice effects, confidence intervals on scores, deeper analytics, longitudinal reports.
**Exit criteria:** The Progress page's "Similar Cognitive Tasks" and "Broader Transfer" sections have real assessment data behind them, not placeholders.
**Dependencies:** Phase 3 (need weeks of trained-task data first).
**Size:** L.
**Status:** Underway — see `docs/kanban.md`'s Phase 6 breakdown for six concrete cards. Four are done: a real psychometric scoring library (`packages/psychometrics`'s real `calculateDPrime`/`calculateSignalDetectionRates`/`calculateProportionConfidenceInterval`); both genuine near-transfer assessments — Backward Digit Span for Working Memory and Backward Spatial Span for Spatial, each a fixed ascending-span staircase (not the adaptive engine), with real `Assessment`/`AssessmentResult` rows carrying a real confidence interval and a shared 14-day periodic-trigger rule (`apps/web/src/lib/near-transfer-assessment.ts`); and wiring the Progress page's "Similar Cognitive Tasks" tab to that real data, replacing its placeholder with each assessment's actual score, confidence interval, and a real "Take"/"Retake" state per assessment — see `docs/kanban.md`'s Done section for all four. Remaining in Backlog, both independent and unblocked: an expanded/rotating reading-passage bank (alternate forms), and a longitudinal trend view (sequenced last since it needs the most real elapsed usage time). No far-transfer assessment card exists — `docs/evidence-review.md` doesn't support a far-transfer claim for any current module, and the Progress page's "Broader Transfer" tab already handles that honestly as a static disclaimer needing no new data.

## Phase 7 — Monetization

**Objective:** Sustainable revenue without compromising scientific credibility.
**Deliverables:** `docs/monetization-plan.md` (done this session, draft-level), Stripe integration, entitlement system, free/premium feature split, pricing experiments.
**Exit criteria:** A user can subscribe and cancel with equal ease; no scientific claim or basic progress view is paywalled; see the Gamification Monetization Rule in `project_prompt.txt`.
**Dependencies:** Phase 3 (need something worth paying for) and ideally Phase 5 (retention mechanics in place before optimizing conversion).
**Size:** L.

## Phase 8 — Mobile MVP

**Objective:** Native-quality iOS/Android apps sharing the web account/data.
**Deliverables:** Cross-platform framework evaluation and decision (see `docs/mobile-plan.md`), shared account system, shared training history, core exercises + reading training ported natively, push notifications (optional, non-manipulative).
**Exit criteria:** Matches MOBILE SUCCESS CRITERIA in `project_prompt.txt` — install, log into the same account, synchronized progress, complete training, native-quality interactions, optional reminders, same achievements, seamless continuation across web/mobile.
**Dependencies:** Phase 3 (web MVP must be validated first — do not start mobile before this per the spec).
**Size:** XL.

## Phase 9 — Mobile Expansion

**Objective:** Take mobile from "works" to "native-grade."
**Deliverables:** Limited offline training with secure sync, widgets where appropriate, advanced haptics, native performance optimization, app-store subscriptions.
**Exit criteria:** Offline sessions sync without duplicate/conflicting records.
**Dependencies:** Phase 8.
**Size:** L.

## Phase 10 — Advanced Product

**Objective:** Expand the validated core.
**Deliverables:** New evidence-approved tasks (re-run the Phase 0 process per task), optional social features (consistency/XP-based, never "intelligence rankings" — see `project_prompt.txt` LEAGUES section), research participation options, personalized training plans.
**Exit criteria:** N/A — ongoing; gated by re-running Phase 0's evidence process for anything new.
**Dependencies:** Everything before it. Do not jump here early.
**Size:** Ongoing.

---

## MVP Philosophy (governs Phase 3 scope decisions)

Per `project_prompt.txt`: build ~3-5 outstanding evidence-supported exercises plus excellent adaptive reading training — not twenty mediocre games. Candidate trim for Phase 3, in priority order: (1) Adaptive N-Back, (2) Complex Span, (3) Reading (paced/adaptive + chunking as a technique within it), (4) Spatial Sequence Recall, (5) Verbal Sequencing — with Verbal Sequencing as the first cut if scope needs to shrink further, since it's the least differentiated from Complex Span mechanically.

## Reference architecture (target for Phase 2)

```text
apps/
  web/
  mobile/        (Phase 8+)
  api/

packages/
  cognitive-engine/
  reading-engine/
  trial-engine/
  adaptive-engine/
  psychometrics/
  evidence/
  design-system/
  shared/

docs/
data/
```

## Cross-cutting risks

- **Technical:** timing-sensitive tasks (`performance.now()`-based) must behave consistently across browsers/devices — needs early device-testing investment, not a Phase 4 afterthought for the timing layer specifically.
- **Research:** far-transfer claims are contested field-wide; any new module added in Phase 10+ must re-run the full Phase 0 evidence process, not get grandfathered in.
- **UX:** the temptation to add "just one more metric" to Home/Progress screens recurs every phase — the 3-second-comprehension rule is the standing check against it.
- **Launch criteria (web):** all items in `project_prompt.txt`'s INITIAL PRODUCT SUCCESS CRITERIA verified via `docs/testing.md`, plus a clean security review (`docs/security.md`) and accessibility pass.
