# LeanAcademy

A scientifically-grounded cognitive-training platform — working memory (updating, span, verbal, visuospatial) and reading-efficiency training, built as a premium consumer product whose science happens to be unusually rigorous, not a research tool users merely tolerate.

The product begins as a **web application** and later expands to native-quality **iOS** and **Android** apps sharing the same account and training history. Full product spec: [`project_prompt.txt`](./project_prompt.txt).

## Current status

**Phase 0/1 — Research & Planning.** No application code exists yet; this repository currently holds the research, product, UX, and planning foundation the spec requires before implementation begins. See `docs/development-plan.md` for the full phase roadmap and `docs/kanban.md` for the live "what's next" board.

## Non-negotiable principles

1. **Evidence before features.** No training method ships without a `data/evidence-registry.json` entry backed by real citations. See `docs/evidence-review.md`.
2. **UI/UX is the highest implementation priority** — among execution concerns, not above scientific integrity. A scientifically correct app that feels confusing or clinical is not a success.
3. **Training gains, near transfer, and far transfer are always kept separate** — in research, database, analytics, progress UI, and marketing copy alike. Never claim IQ increase, dementia prevention, ADHD cure, or general intelligence gains.

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/product-requirements.md`](./docs/product-requirements.md) | Vision, users, requirements, metrics, risks |
| [`docs/evidence-review.md`](./docs/evidence-review.md) | Narrative literature review per training domain |
| [`data/evidence-registry.json`](./data/evidence-registry.json) | Machine-readable evidence registry gating the exercise catalog |
| [`docs/ux-strategy.md`](./docs/ux-strategy.md) | User journeys, information architecture, critical path |
| [`docs/design-system.md`](./docs/design-system.md) | Visual/interaction language: tokens, typography, motion, a11y |
| [`docs/development-plan.md`](./docs/development-plan.md) | Phased roadmap (Phase 0–10), sizing, risks |
| [`docs/kanban.md`](./docs/kanban.md) | Live epics + executable cards |
| [`docs/mobile-plan.md`](./docs/mobile-plan.md) | iOS/Android technology evaluation and phased plan |
| [`docs/monetization-plan.md`](./docs/monetization-plan.md) | Freemium structure, pricing, guardrails |
| [`docs/security.md`](./docs/security.md) | Auth, data protection, privacy commitments |
| [`docs/testing.md`](./docs/testing.md) | Test strategy across all layers, launch readiness gate |
| [`env_development.md`](./env_development.md) | For the operator: how to use this Claude Code environment to move this specific project forward faster |

## Suggested technology direction (confirm at Phase 2)

Next.js, React, TypeScript, PostgreSQL, Drizzle or Prisma, Zod, Tailwind CSS, Playwright, Vitest — organized as a monorepo separating `apps/{web,api,mobile}` from `packages/{cognitive-engine,reading-engine,trial-engine,adaptive-engine,psychometrics,evidence,design-system,shared}`. See `docs/development-plan.md` for the full reference architecture and `docs/mobile-plan.md` for the mobile-specific evaluation (React Native/Expo recommended, re-confirm at Phase 8).

## Next steps

See `docs/kanban.md` → **Ready (Phase 2 — Technical Foundation)** for the first executable batch of implementation cards, and `docs/ux-strategy.md` for the interactive-prototype work that should validate the critical path before that implementation begins in earnest.
