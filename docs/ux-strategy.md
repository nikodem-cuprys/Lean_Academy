# UX Strategy — LeanAcademy

_Phase 1 (UX Foundation) draft. Per `project_prompt.txt`: UX must be validated before building dozens of exercises — this document, plus an interactive prototype (recommend building it with the Claude Code `design` skill once this direction is approved), is the Phase 1 deliverable._

## Personas / jobs-to-be-done

See `docs/product-requirements.md` § Users for the four core personas (consistency seeker, improver, skeptic, efficiency reader). Every journey below is designed primarily around the **consistency seeker** (default path) with explicit branches for the **skeptic** (Science page reachable from anywhere) and **efficiency reader** (reading training discoverable independent of WM training).

## Core journeys / screens

The spec requires flows/wireframes for these 14 screens before full implementation. For each: primary goal, the one action that matters most, and what must NOT be on the screen.

1. **Landing** — Goal: communicate "premium, scientifically honest cognitive training" in one glance. Primary action: Sign up / Start. Must not: stock-photo brain imagery, vague "boost your brain" copy, IQ claims.
2. **Signup/login** — Goal: minimum-friction account creation. Primary actions: Continue with Google, Continue with Facebook, Email. Must not: ask for anything beyond email/name before the account exists.
3. **Onboarding** — Goal: goals → available time → experience level, in as few screens as possible. Primary action: advance. Must not: psychometric jargon (no "N=3 updating load" — see `project_prompt.txt` INTUITIVE LEVEL SELECTION).
4. **Level selection** — Goal: present Beginner/Intermediate/Advanced/Expert/Custom with a recommended default pre-selected after calibration. Primary action: "Use recommended" (one tap) vs. "Choose another level."
5. **Baseline/calibration** — Goal: a short calibration (not a 30-minute battery) that seeds initial difficulty. Primary action: complete the short exercise. Must not: feel like a test with a pass/fail framing.
6. **Home** — Goal: "what do I do right now." Primary action: Start Training. Secondary, below the fold only: streak, level, weekly progress, upcoming assessment, recent achievement. Must not: a dashboard of dozens of metrics before training starts.
7. **Daily training** — Goal: show the day's short multi-exercise plan and its total time before starting. Primary action: Start Training.
8. **Exercise** — Goal: pure focus; the user should never wonder what to do. Primary action: respond to the stimulus. Must not: decorative UI elements that interfere with stimulus timing (see `docs/product-requirements.md` timing integrity requirement).
9. **Exercise results** — Goal: immediate, honest per-exercise feedback (accuracy/RT/level change as applicable). Primary action: Continue (to next exercise, without returning to a menu).
10. **Session complete** — Goal: cohesive session summary + any earned progress/achievement. Primary action: Return home (or start another short session).
11. **Progress** — Goal: Trained Tasks / Similar Cognitive Tasks / Broader Transfer sections, each showing only evidence-supported claims. Primary action: drill into one task's history. Must not: single combined "brain score."
12. **Achievements** — Goal: show real, action-based milestones. Must not: any "X% smarter" style badge.
13. **Science** (`/science`) — Goal: per-exercise what/why/how/evidence-level/transfer/population/limitations/citations, sourced from the evidence registry. Reachable in one tap from any exercise.
14. **Profile/settings** — Goal: display name, avatar, daily goal, difficulty preferences, linked auth providers, data export/delete, privacy settings, subscription management.
15. **Subscription/paywall** — Goal: clear value (more content/personalization/analytics), never implying training effectiveness itself is gated. Primary action: choose plan. Cancellation must be exactly as easy as subscribing (see `docs/monetization-plan.md`).

## Information architecture

```
/                      Landing (logged out)
/login, /signup        Auth (email + OAuth)
/onboarding/*           goals -> time -> level -> calibration -> plan
/home                   Daily session entry point (default logged-in route)
/train/:sessionId       Cohesive multi-exercise flow (no menu between exercises)
/train/:sessionId/done  Session complete summary
/progress               Trained / Similar / Broader Transfer
/science                Index of all exercises with evidence detail
/science/:exerciseId    Single-exercise deep dive
/achievements
/profile, /settings
/subscription
```

## Optimizing the critical path

Shortest reasonable route from opening the app to starting meaningful training: **Landing → Signup (one OAuth tap or email) → 3-4 onboarding screens → calibration → Home (recommended level pre-selected) → Start Training → Exercise 1.** Every screen in that path must justify its own existence; if a step can be deferred to "after the first session" (e.g. deeper preference tuning), defer it.

## Usability-testing scenarios

To validate before broad rollout (a new user should complete these without instruction):

- "Start your first training session."
- "Choose an easier level."
- "Find your reading progress."
- "Change your daily goal."
- "Find the science supporting this exercise."
- "Cancel a subscription."

## Wireframes / interactive prototype

This document defines structure and content intent at a text level. The next concrete step is a clickable prototype for the critical path (Landing → first exercise) and the Home/Exercise/Results loop, since those carry the most first-impression risk. Recommend producing that with the Claude Code `design` skill (multi-artboard canvas, closer to real visual fidelity than static wireframes) rather than a separate wireframing tool — see `env_development.md` for when to reach for it.

## Design system dependency

Visual language (tokens, typography, components, motion, themes) is specified separately in `docs/design-system.md` — this document defines *what* each screen must accomplish; that one defines *how it looks and feels*.
