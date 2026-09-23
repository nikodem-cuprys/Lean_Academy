# LeanAcademy

**Evidence-based working-memory and reading-efficiency training — with the science shown, not oversold.**

LeanAcademy is a cognitive-training web app built around one rule: every exercise has to earn its place through published research, and the app only ever claims what that research actually supports. You practice short, adaptive exercises; the app shows you honest progress on the tasks you trained, keeps "similar tasks" and "broader transfer" as clearly separate measures, and tells you plainly when something hasn't been shown to work.

> **Status: pre-release, in active development.** The web app is functional end to end (accounts, onboarding, daily sessions, progress tracking, gamification, six languages). Payments and the native mobile apps are not built yet. See [Roadmap](#roadmap).

---

## What it is — and what it isn't

| LeanAcademy **does** | LeanAcademy **does not** |
| --- | --- |
| Train specific working-memory and reading skills with adaptive difficulty | Claim to raise IQ or "general intelligence" |
| Show your real improvement on the exercises you trained | Claim to prevent dementia, treat ADHD, or treat any condition |
| Measure near transfer periodically, on tasks you *haven't* practiced | Blur trained-task gains, near transfer, and far transfer together |
| Always pair reading speed (WPM) with comprehension | Show a reading-speed number without its comprehension figure |
| Show which methods it reviewed and **rejected**, and why | Include methods whose evidence doesn't hold up |

## Features

- **Adaptive daily sessions.** A short "Today's Training" session strings exercises from different domains together. Difficulty adjusts gradually from a rolling window of your recent performance, never jumping on one lucky or unlucky trial.
- **Onboarding calibration.** A roughly 90-second, no-pass-or-fail calibration picks your starting level. Levels are always shown in plain language (Beginner → Expert, or Auto), never as raw internal numbers.
- **Honest progress tracking.**
  - **Trained tasks:** your level history and personal bests on each exercise.
  - **Similar tasks (near transfer):** periodic Backward Digit Span and Backward Spatial Span assessments, reported with confidence intervals.
  - **Broader transfer:** deliberately not measured or scored, because current research doesn't support it for these exercises.
- **Long-term trends.** Per-task time-series charts, shown only once there's enough spread-out history to avoid drawing a misleading line.
- **Motivation without manipulation.** Streaks with streak freezes, XP and training levels, achievements, daily quests and weekly challenges. All are tied to real, checkable actions and capped to avoid rewarding excessive use.
- **The Science page.** Rendered directly from the project's evidence registry: evidence level per method, what's in your training, and what was excluded.
- **Six languages.** English, Polski, Español, Deutsch, Français and 简体中文. The language is detected from your browser, can be changed with a switcher, and is saved to your account. Reading passages stay in English in every language, because pace and comprehension scoring are calibrated on English text.
- **Accessible and responsive.** Phone, tablet and desktop layouts; keyboard and screen-reader support, checked with automated axe-core scans.
- **Accounts.** Email and password sign-in with email verification and password reset. Google and Facebook sign-in are wired in, but a full real-browser Google sign-in hasn't been confirmed yet.

## Training exercises

| Exercise | Domain | What adapts | Evidence level |
| --- | --- | --- | --- |
| Adaptive N-Back | Working memory | N (how many steps back) | Moderate |
| Complex Span | Working memory | Set size | Moderate |
| Dice Sum | Working memory | Number of dice | Limited |
| Spatial Sequence Recall | Spatial memory | Sequence length | Moderate |
| Paced Reading | Reading efficiency | Target WPM, gated by comprehension | Moderate |

Evidence levels come from [`docs/evidence-review.md`](./docs/evidence-review.md), which reviews each method's evidence quality, population studied, and limitations, keeping trained-task gains, near transfer and far transfer separate. Methods reviewed and **excluded** from the catalog include single-word RSVP "speed reading", skimming/scanning drills, and flanker/go-no-go interference training.

The standalone exercises can be customized (pace presets, die sides, grid size). Daily sessions always run at the pace the research was conducted at, so your progression stays comparable over time.

## How the evidence gating works

Nothing reaches users without passing through the evidence chain:

1. **[`docs/evidence-review.md`](./docs/evidence-review.md)**: a narrative literature review per training method, with citations.
2. **[`data/evidence-registry.json`](./data/evidence-registry.json)**: the machine-readable mirror of that review. Only modules marked `productionApproved: true` can load.
3. **`packages/evidence`**: loads and validates the registry (Zod). It is the single gate the exercise catalog must go through.
4. **The database**: a synced read-only mirror of the registry, used for queries like the Science page. The reviewed JSON stays the source of truth.

Adding or changing a training method means updating the review and the registry together, in the same change.

## Tech stack

- **Web:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- **Auth:** Auth.js (credentials + Google + Facebook OAuth), bcrypt, rate limiting
- **Data:** PostgreSQL + Prisma
- **API service:** Fastify (`apps/api`)
- **i18n:** next-intl (type-checked message keys, compile-time parity across locales)
- **Validation:** Zod
- **Testing:** Vitest (unit), Playwright + axe-core (end-to-end and accessibility)
- **Tooling:** pnpm workspaces monorepo

## Getting started

### Prerequisites

- **Node.js 20+**
- **pnpm** (this is a pnpm workspace; don't use npm or yarn)
- **PostgreSQL** (tested with 17). Use a dedicated role and database for this project.

### 1. Install

```bash
git clone https://github.com/nikodem-cuprys/Lean_Academy.git
cd Lean_Academy
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp .env.example packages/db/.env   # the Prisma CLI reads .env from its own directory
```

Then edit both files:

- `DATABASE_URL`: your Postgres connection string. The role needs `CREATEDB` so Prisma can create its shadow database during migrations.
- `NEXTAUTH_SECRET`: generate one with `openssl rand -base64 32`.
- `GOOGLE_CLIENT_*` / `FACEBOOK_CLIENT_*`: optional; email and password sign-in works without them.
- `SMTP_*`: the defaults point at the local mail catcher below.

Never commit either `.env` file (both are gitignored).

### 3. Set up the database

```bash
pnpm db:migrate                           # apply migrations
pnpm --filter @lean-academy/db seed       # sync the evidence registry, task definitions and achievements
```

### 4. Run it

```bash
pnpm dev        # web app at http://localhost:3000
pnpm dev:mail   # optional: local SMTP + inbox UI at http://localhost:1080 for verification/reset emails
```

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the web app (Next.js dev server) |
| `pnpm build` | Build every app and package |
| `pnpm typecheck` | Type-check everything (also enforces translation-key parity) |
| `pnpm lint` | Lint |
| `pnpm test` | Unit tests across all packages |
| `pnpm db:generate` | Regenerate the Prisma client after editing the schema |
| `pnpm db:migrate` | Create or apply a Prisma migration |

### End-to-end tests

Playwright tests expect a server that's already running. A production build gives the most deterministic results:

```bash
cd apps/web
pnpm exec next build
pnpm exec next start -p 3000    # with DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, AUTH_TRUST_HOST=true set
pnpm exec playwright test       # in another terminal
```

## Project structure

```text
apps/
  web/                Next.js app: every screen, API routes, auth, i18n
  api/                Fastify service: /health, /catalog (evidence-gated module list)
packages/
  evidence/           Evidence-registry loader, validator and catalog gate
  adaptive-engine/    Gradual, rolling-window difficulty adaptation
  cognitive-engine/   N-Back, Complex Span, Spatial Sequence, Dice Sum task logic
  reading-engine/     Paced reading task, passage bank, Reading Efficiency Score
  db/                 Prisma schema, migrations, seed, client
  design-system/      Design tokens
  shared/             Plain-language labels shared across apps
  psychometrics/      Accepted psychometric calculations (e.g. confidence intervals)
  trial-engine/       Shared stimulus/timing runtime (in progress)
data/
  evidence-registry.json
docs/                 Product, research, design, planning and process docs
prototype/            Interactive design-canvas prototype, the visual reference for the UI
```

## Documentation

| Doc | Purpose |
| --- | --- |
| [Product requirements](./docs/product-requirements.md) | Vision, users, requirements, metrics, scientific-honesty rules |
| [Evidence review](./docs/evidence-review.md) | Literature review per training method |
| [UX strategy](./docs/ux-strategy.md) | User journeys and information architecture |
| [Design system](./docs/design-system.md) | Tokens, typography, motion, accessibility |
| [Development plan](./docs/development-plan.md) | Phased roadmap (Phase 0–10) |
| [Kanban](./docs/kanban.md) | Live board: what's done, next, and planned |
| [Security](./docs/security.md) | Auth, data protection, privacy commitments |
| [Testing](./docs/testing.md) | Test strategy and launch-readiness gate |
| [Mobile plan](./docs/mobile-plan.md) | iOS/Android approach |
| [Monetization plan](./docs/monetization-plan.md) | Freemium structure and guardrails |
| [CLAUDE.md](./CLAUDE.md) | Detailed contributor/agent guide: architecture, gotchas, conventions |

## Roadmap

| Area | Status |
| --- | --- |
| Research, UX foundation, technical foundation | ✅ Done |
| Web MVP: auth, onboarding, five exercises, daily sessions, progress | ✅ Done |
| Engagement: streaks, XP, achievements, quests, challenges | ✅ Done |
| Advanced measurement: near-transfer assessments, long-term trends | ✅ Done |
| Internationalization (6 languages) | ✅ Done |
| Monetization: subscriptions via Stripe | 🚧 In progress (entitlements built, checkout not yet) |
| More methods: verbal sequencing, method of loci, running memory | 📋 Planned (evidence-approved, not yet built) |
| Native iOS and Android apps sharing the same account | 📋 Planned |

For card-level detail, see [`docs/kanban.md`](./docs/kanban.md).

## Contributing

This project is in early development and isn't set up for outside contributions yet. If you open an issue or a pull request, please keep to its core rules:

- **Evidence first.** New or changed training methods need a matching update to `docs/evidence-review.md` and `data/evidence-registry.json`.
- **No unsupported claims** in code, copy or docs, in any language: no IQ, intelligence, dementia or ADHD claims.
- **Keep trained-task gains, near transfer and far transfer separate** everywhere.
- **Translate new UI text** into all six message files in `apps/web/src/messages/`. `pnpm typecheck` fails otherwise.
- Keep `pnpm typecheck`, `pnpm lint`, `pnpm test` and the Playwright suite green.

## Disclaimer

LeanAcademy is a skills-practice tool, not a medical device. It is not intended to diagnose, treat, cure or prevent any condition, and it makes no claim of improving general intelligence. If you have concerns about your memory or attention, please talk to a qualified health professional.

## License

Released under the [MIT License](./LICENSE).
