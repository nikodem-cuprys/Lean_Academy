# LeanAcademy

A scientifically-grounded cognitive-training platform — working memory (updating, span, verbal, visuospatial) and reading-efficiency training, built as a premium consumer product whose science happens to be unusually rigorous, not a research tool users merely tolerate.

The product begins as a **web application** and later expands to native-quality **iOS** and **Android** apps sharing the same account and training history. Full product spec: [`project_prompt.txt`](./project_prompt.txt).

## Current status

**Phase 2 — Technical Foundation, in progress.** The pnpm-workspace monorepo scaffold, Prisma schema, evidence-registry loader, and adaptive-engine skeleton are done; auth backend/config works but the login/signup UI and real email delivery are still open. See `docs/development-plan.md` for the full phase roadmap, `docs/kanban.md` for the live "what's next" board, and `CLAUDE.md` for how to build/run/test this repo.

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

## Technology stack

Next.js 16 (App Router) + React + TypeScript, PostgreSQL via Prisma, Zod, Tailwind CSS, Auth.js, Fastify (`apps/api`), Vitest — a pnpm-workspace monorepo separating `apps/{web,api}` from 8 `packages/*`. See `CLAUDE.md` for the concrete layout and commands, and `docs/mobile-plan.md` for the mobile-specific evaluation (React Native/Expo recommended, re-confirm at Phase 8).

## Next steps

See `docs/kanban.md` → **Ready** for the next executable batch (running the first real Prisma migration, the login/signup UI, and email delivery), and `prototype/` for the approved visual reference the real screens should be built against.
