# Testing Strategy — LeanAcademy

_Companion to `docs/security.md` and `docs/ux-strategy.md`. Suggested stack per `project_prompt.txt`: Playwright (E2E) and Vitest (unit/integration)._

**Status:** Drafted in Phase 0/2 as a strategy document; not yet revisited line-by-line against the real Phase 3-5 implementation. Substantial real Playwright coverage already exists (accessibility, responsive, performance, motion, streaks, achievements, onboarding, session, progress, science, and all four exercise specs in `apps/web/e2e/`) that this checklist doesn't yet reflect back — see `docs/kanban.md`'s Done section for what's actually covered and how.

## Test layers

- **Unit tests:** pure logic — adaptive-engine difficulty curves, reading-efficiency-score formula (including the comprehension floor), psychometrics calculations (d-prime, span scoring, WPM/comprehension aggregation), evidence-registry schema validation.
- **Integration tests:** API routes against a real (test) database — auth flows, session/trial recording, entitlement checks.
- **E2E tests (Playwright):** full user journeys end to end in a real browser — see Feature checklist below.
- **Scientific-calculation tests:** specifically isolated tests for anything that produces a number shown to the user (WPM, comprehension %, reading efficiency score, span level, d-prime, switch cost) — these get extra scrutiny because an incorrect calculation here is both a bug and a scientific-integrity violation.
- **UI tests:** component-level rendering/interaction tests for the shared design-system component library.
- **Accessibility checks:** automated (axe-core or equivalent) in CI plus manual keyboard-navigation and screen-reader spot checks per release.

## Feature checklist (must have explicit test coverage before Web Launch Readiness)

Registration · email login · Google login · Facebook login · logout · account linking · onboarding · difficulty selection · daily session · exercise completion · adaptive difficulty (gradual, never single-trial swings) · reading WPM calculation · reading comprehension scoring · reading efficiency score (with comprehension floor enforced) · progress display · achievements (earned only for real actions) · streaks (including protection behavior) · subscription entitlements (grant, restrict, cancel).

## Scientific-integrity checks (test, don't just review)

- A synthetic "high WPM, low comprehension" reading result must never produce a Reading Efficiency Score that reads as an improvement — write a test that asserts this directly against the formula in `docs/product-requirements.md`.
- Adaptive-engine tests assert that one correct/incorrect trial alone cannot move difficulty by more than the defined rolling-window step.
- A test asserts that no exercise outside `data/evidence-registry.json`'s `productionApproved: true` set can be loaded by the catalog (mirrors the Kanban card "Evidence Registry Loader & Catalog Gate").
- A copy/content lint (even a simple grep-based CI check) for prohibited phrases ("IQ", "smarter", "cure", "prevent dementia", etc.) across user-facing strings, as a cheap backstop against accidental scientific overclaiming creeping into copy.

## UX / usability testing (code coverage is not enough)

Run the scenarios from `docs/ux-strategy.md` with real or representative users, unassisted:

- "Start your first training session."
- "Choose an easier level."
- "Find your reading progress."
- "Change your daily goal."
- "Find the science supporting this exercise."
- "Cancel a subscription."

A new user should complete each without instruction whenever reasonably possible; treat any scenario that requires help as a UX defect, not a training/documentation gap.

## Performance testing

Define and track targets for page load, interaction response, route transitions, and exercise startup time (see `docs/product-requirements.md` Non-functional requirements); verify nothing large loads during an active timed exercise, since that risks both perceived jank and actual stimulus-timing integrity.

## Timing-integrity testing

For any `performance.now()`-based reaction-time task: tests/manual verification that stimulus-start and response timestamps are captured correctly, that page-visibility/focus-loss events are detected and the affected trial is flagged or excluded (not silently treated as clean data), and that this behavior is consistent across the target browser/device matrix.

## Launch readiness gate

Before calling Web MVP launch-ready, verify: science content accuracy (matches `data/evidence-registry.json`), full UX scenario pass, security review (`docs/security.md`), performance targets met, accessibility pass, payments flow (subscribe + cancel), and analytics events firing correctly (`docs/product-requirements.md` Metrics).
