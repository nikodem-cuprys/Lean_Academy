# Mobile Plan — LeanAcademy

_Phase 8-9 planning, per `project_prompt.txt`. Mobile development begins only after the web MVP (Phase 3) demonstrates a successful core experience — this document is prepared early so the shared-architecture decisions in Phase 2 don't accidentally foreclose mobile options later._

**Status:** Still accurate as a Phase 8-9 early-prepared plan — no implementation has started, nothing to reconcile yet. Re-confirm the ecosystem evaluation for real at the start of Phase 8 (already noted below).

## Cross-platform technology evaluation

| Option | Fit for this product | Trade-off |
|---|---|---|
| **React Native + Expo (recommended default)** | Strong fit: the spec's suggested web stack is already TypeScript/React, so trial-engine, adaptive-engine, evidence, and psychometrics packages can be shared close to as-is between `apps/web` and `apps/mobile`. Expo's managed workflow covers push notifications, haptics, and app-store builds without early native-module maintenance burden. | Reaction-time-sensitive tasks need careful validation on RN's JS thread vs. native timing — budget explicit device-testing time for this, don't assume web-equivalent timing precision for free. |
| **Flutter** | Excellent native performance and animation quality out of the box. | No code/logic sharing with the TypeScript web stack — the cognitive/adaptive/psychometrics engines would need a second implementation (in Dart) or a cross-language bridge, which directly conflicts with the SHARED ARCHITECTURE goal of one set of training algorithms. |
| **Native Swift/Kotlin** | Best possible native quality and timing precision. | Two fully separate codebases for iOS/Android, plus no sharing with web at all; justified only if RN's timing precision genuinely proves inadequate for the reaction-time paradigms during Phase 8 evaluation. |

**Recommendation:** React Native + Expo, re-confirmed against the ecosystem's state at the start of Phase 8 (not assumed frozen from this document — the spec explicitly asks to evaluate the latest ecosystem before deciding). Fall back to native only for a specific measured task where RN's timing precision is demonstrated (not assumed) to be inadequate.

## Shared architecture

Share across web and mobile: API, authentication, database, business logic, training algorithms (`packages/trial-engine`, `packages/adaptive-engine`, `packages/cognitive-engine`, `packages/reading-engine`), evidence registry, analytics schemas, and design tokens (design *tokens* — spacing/color/type-scale values — are shareable even where the component implementations differ between web CSS and RN styling).

## Native-quality requirements (non-negotiable per spec)

Gestures, performance, transitions, offline behavior, notifications, sound/haptics, and accessibility must all be native-quality — the mobile app is explicitly required NOT to be a WebView wrapper around the web app.

## Mobile UX considerations

Exercises are designed for mobile from scratch (not shrunk desktop layouts): touch-target sizing for tap accuracy, device orientation handling, safe-area insets, no dependency on a hardware keyboard, haptic feedback for correct/incorrect responses and level-ups, resilience to interruptions (calls, notifications) during a timed task, and awareness that reaction-time measurements may differ by device — device context (model, OS) should be stored alongside trial data where scientifically relevant so cross-device variance can be analyzed rather than silently conflated.

## Phase 8 — Mobile MVP breakdown

- Framework spike + final decision (confirm or revise the recommendation above against the then-current ecosystem).
- Shared account system: same login (email/Google/Facebook) authenticates on mobile against the same backend.
- Shared training history: a user's web progress is visible immediately on first mobile login, no separate onboarding/calibration required.
- Port the Phase 3 exercise set + reading training to native-quality mobile implementations (not a straight UI port — see Mobile UX considerations above).
- Push notifications: optional, opt-in, non-manipulative copy only (see `project_prompt.txt` NOTIFICATIONS section — "Your 10-minute session is ready," never "Your memory is getting worse").

## Phase 9 — Mobile Expansion breakdown

- **Offline training:** download a training plan, complete supported exercises offline, store results locally, sync securely when back online. Sync design must explicitly handle conflict/duplicate-session prevention (e.g. idempotent session IDs generated client-side at plan-download time, last-write-wins only where safe, otherwise merge rather than overwrite).
- Home-screen widgets where the platform supports something genuinely useful (e.g. streak/daily-goal glance), not added for its own sake.
- Advanced haptics and native performance optimization passes once real usage data identifies actual jank/friction points.
- App-store subscriptions (see `docs/monetization-plan.md` for entitlement-sync requirements across web/iOS/Android).

## Compliance note

Apple App Store and Google Play billing rules change; re-verify current requirements at the start of Phase 8/implementation of Payments-on-mobile rather than trusting this document's assumptions to still be accurate by then.

## Mobile success criteria (from spec, restated as the Phase 8/9 exit bar)

A user can install the iOS or Android app, log into the same account, see synchronized progress, complete training, get high-quality native interactions, use optional reminders, earn the same achievements, and continue training seamlessly across web and mobile.
