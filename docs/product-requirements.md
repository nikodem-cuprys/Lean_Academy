# Product Requirements Document — LeanAcademy

_Written during Phase 0 (Research & Planning); the requirements below haven't changed since, so this stays the living reference through implementation (currently Phase 5) — see `docs/kanban.md` for what's actually built against it so far. Source spec: [`project_prompt.txt`](../project_prompt.txt). Evidence backing: [`docs/evidence-review.md`](./evidence-review.md) / [`data/evidence-registry.json`](../data/evidence-registry.json)._

## Vision

A cognitive-training platform people actually want to open again tomorrow, whose scientific rigor is unusually high but never gets in the way of the experience feeling premium, fast, and motivating. It begins as a web app and expands to native-quality iOS/Android apps once the web core is validated. See the FINAL RULE in `project_prompt.txt`: this should feel like "a premium, enjoyable training product whose science happens to be unusually rigorous," not "a scientific experiment users tolerate."

## Users

- **The consistency seeker** — wants a short daily habit (5–10 min) that feels worthwhile, not a research study.
- **The improver** — wants to see real, honestly-labeled progress on specific tasks (working memory span, reading speed+comprehension) and understands the difference between training gains and transfer once it's explained simply.
- **The skeptic** — has seen brain-training marketing before and will bounce immediately if anything smells like an unsupported IQ claim; the Science page and honest language are what keep this user.
- **The efficiency reader** — specifically wants to read faster without losing comprehension (students, professionals, heavy readers); may arrive primarily for reading training and discover WM training secondarily.

## Jobs-to-be-done

1. "Give me a short, engaging daily mental workout I'll actually stick with."
2. "Help me read faster without missing what I read."
3. "Show me real, believable progress — not made-up scores."
4. "Let me start immediately without a science lecture, but let me go deep on the research if I want to."
5. "Don't guilt-trip me if I miss a day."

## User stories (representative, not exhaustive — see `docs/kanban.md` for execution-level cards)

- As a new user, I can sign up with email, Google, or Facebook and reach my first training exercise in well under two minutes.
- As a new user, I get a short calibration and a recommended difficulty level I can accept with one tap or change.
- As a returning user, I open the app and immediately see today's recommended session and a single primary "Start Training" action.
- As a user mid-session, I move between exercises without returning to a menu.
- As a user, after each session I see a clear, honest summary of what changed — never an inflated or pseudoscientific claim.
- As a reading-training user, I always see WPM and comprehension together, never WPM alone.
- As a user, I can find the research behind any exercise in one tap from that exercise.
- As a user, I can export or delete my data.
- As a subscriber, cancelling is exactly as easy as subscribing.

## Functional requirements

- Account system: email+password (with verification, reset flow) and Google/Facebook OAuth (PKCE), with an `Identity`/`AuthProvider` model that supports account linking and future providers (see `docs/security.md`).
- Onboarding: goals → available time → experience level → short calibration → recommended level (accept or change) → first plan. Must be completable quickly (spec explicitly warns against a 30-minute onboarding).
- Adaptive training engine: shared `AdaptiveTrainingTask` interface (see `project_prompt.txt` ADAPTIVE TRAINING ENGINE section) driving gradual, rolling-window difficulty adjustment — never single-trial swings up or down.
- Exercise catalog gated by the evidence registry: only modules with `productionApproved: true` in `data/evidence-registry.json` may load in production.
- Reading training: baseline across multiple varied passages, paced/adaptive reading exercise, comprehension questions, combined Reading Efficiency Score with a comprehension floor (see Scientific Requirements below).
- Daily training: a short recommended multi-exercise session, configurable daily goal (5/10/15/20/custom minutes).
- Progress: Trained Tasks / Similar Cognitive Tasks / Broader Transfer dashboard sections, each only showing claims the evidence registry supports.
- Science page (`/science`): per-exercise what/why/how, evidence level, transfer status, population, limitations, citations, review date — sourced directly from the evidence registry so it can never drift out of sync with what's shown elsewhere.
- Gamification (Phase 5+): streaks with protection and non-manipulative copy, XP with anti-grinding caps, training levels explicitly separate from and never framed as cognitive ability, achievements tied to real actions, weekly challenges, personal bests.
- Monetization (Phase 7+): freemium split per `docs/monetization-plan.md`; premium never gates whether training itself is effective, only personalization/content/analytics/convenience.

## Non-functional requirements

- Performance: fast page loads, fast route transitions, preloaded next exercise, no large dashboard dependencies loaded during an active timed task (timing integrity depends on this).
- Accessibility: keyboard navigation, screen-reader support where task mechanics allow, high contrast, reduced motion, font scaling, color-blind-safe palettes; reading mode gets adjustable font size/line spacing/column width/theme, while standardized assessment passages keep display conditions controlled.
- Responsiveness: full desktop and mobile-browser support pre-dates the native mobile app; mobile exercises are designed for touch, not shrunk desktop layouts.
- Reliability of timing: reaction-time tasks use `performance.now()`, track stimulus/response timestamps, page visibility, focus loss, and interruptions; interrupted trials are never treated as clean data.
- Privacy/security: see `docs/security.md`. Cognitive-performance data is never sold individually and never exposed publicly on a profile.

## Scientific requirements

- Every training method in the catalog must have a `data/evidence-registry.json` entry with citations before it can ship (see `docs/evidence-review.md` for the current review).
- Trained-task improvement, near transfer, and far transfer are tracked and displayed as separate concepts everywhere — research, database, analytics, progress UI, and marketing copy alike.
- Reading efficiency must never reward WPM increases that come with meaningful comprehension loss. A comprehension floor gates how much a speed gain can count toward the combined Reading Efficiency Score; the exact floor value should be set from the reading-research literature reviewed in `docs/evidence-review.md` §8, not chosen arbitrarily.
- Every scientific task carries a version string (e.g. `visual-nback-v1.3`); changing stimulus logic or scoring creates a new version rather than silently altering the meaning of historical scores.
- Prohibited claims, always: IQ increase, general intelligence increase, dementia prevention, ADHD cure, treatment of neurological disorders, guaranteed school/work performance gains. See `SCIENTIFIC PROGRESS LANGUAGE` examples in `project_prompt.txt`.

## UX requirements

- Every screen should be understandable by a new user in roughly 3 seconds; if not, simplify it.
- Progressive disclosure: simple choices up front (Beginner/Intermediate/Advanced/Expert/Custom, with Auto-adaptive as the recommended default), deeper scientific parameters available but never required.
- Home screen shows today's session and one primary action, not a dashboard of dozens of metrics.
- Training sessions flow exercise-to-exercise without returning to a menu between activities.
- See `docs/ux-strategy.md` for the full journey map and `docs/design-system.md` for the visual language.

## Metrics

Product: activation, onboarding completion, first-session completion, D1/D7/D30 retention, sessions/week, training-plan completion, exercise abandonment, subscription/trial conversion, churn.

Scientific: task performance (accuracy, RT, d-prime, hit/false-alarm rate, span, switch cost as applicable), near-transfer assessment results, difficulty progression, reading WPM, comprehension accuracy, reading efficiency score.

Explicitly not a primary metric: raw screen time / session count maximization (the spec is explicit that this must not be optimized as the primary success metric).

## Risks

- **Research risk:** far-transfer claims are the most litigated area of this entire field; overclaiming here is a credibility (and possibly regulatory/advertising) risk. Mitigation: the evidence-gated catalog and the Science page.
- **UX risk:** the spec ranks UI/UX above scientific presentation depth in trade-off priority *among implementation concerns* — but explicitly forbids using that ordering to justify compromising validity. Getting this balance visibly right (premium feel + honest claims) is the single biggest product risk.
- **Scope risk:** the spec describes an enormous eventual surface area (web + iOS + Android, 10+ docs, dozens of features). MVP discipline (3–5 outstanding exercises + reading training, per the spec's own MVP Philosophy) is required to avoid building "20 mediocre games."
- **Monetization risk:** paywalling in a way that reads as "pay to see if this works" would undermine the scientific-credibility brand; see the explicit anti-patterns in `docs/monetization-plan.md`.
- **Regulatory/compliance risk:** health-adjacent claims (even indirectly implied) can draw regulatory scrutiny in some markets; the product must never present itself as a clinical assessment tool.

## Out of scope (current phase)

- Clinical assessment / diagnostic positioning of any kind.
- Reproducing protected clinical instruments (WAIS/WISC subtests, standardized OSPAN, etc.) — original implementations of open paradigms only.
- Social/league features, B2B offerings, family plans, offline mobile sync — all explicitly later-phase per `docs/development-plan.md`.
- Native mobile apps — begin only after the web MVP demonstrates the core experience (Phase 8+).
