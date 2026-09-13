# Environment & Development Guide (for the operator)

_This file is for you, the human running Claude Code on this project — not for the app. It's about using this specific environment efficiently to move LeanAcademy through the phases in `docs/development-plan.md` faster, plus what's worth learning yourself so you can drive (and sanity-check) the work rather than just approve it._

## How to read this

Each section below is tied to a phase of the project so you reach for the right tool/skill at the right time instead of guessing. Nothing here is required — it's the fastest path we've identified given how this environment actually works.

---

## 1. Phase-to-tool mapping

### Phase 0 — Research (mostly done, but recurring)

Evidence review is never really "finished" — new modules in Phase 10 re-trigger it. When you need a new literature pass:

- Ask directly for a **WebSearch**-backed research pass rather than asking for research "from memory" — cognitive-training science moves and meta-analyses get superseded; always want current sources with real URLs, like this session did for `docs/evidence-review.md`.
- For a large, multi-domain research pass (e.g. adding a whole new training category later), consider asking for a **fork** or a dedicated research subagent so the raw search noise doesn't bloat the main session's context — you get back a synthesized writeup, not a wall of search results.
- Keep `docs/evidence-review.md` and `data/evidence-registry.json` in sync manually — nothing enforces this automatically yet. When you ask for a new module, ask for both files to be updated together, in the same turn.

### Phase 1 — UX Foundation

- Use the **`design`** skill to turn `docs/ux-strategy.md`'s screen list into an actual clickable, multi-artboard prototype before real implementation starts. This is worth doing before Phase 2/3 — the spec is explicit that UX must be validated before building a large exercise catalog, and a prototype is far cheaper to iterate on than shipped code.
- Use **Plan Mode** (what produced this very file) any time you're about to make an architecture-affecting decision — database schema, adaptive-engine interface, auth provider model. It forces an explicit plan you can review before code gets written, which is cheap insurance on decisions that are expensive to reverse later.

### Phase 2 — Technical Foundation (done)

- This is where you'll want the **`Plan`** subagent most: architecture decisions (monorepo tooling, Drizzle vs Prisma, schema design) benefit from a dedicated design pass rather than being decided inline.
- Once there's a real app, the **`run`** skill launches and drives it so you can see things actually working in a browser rather than trusting test output alone.
- Before merging any auth/security-adjacent work, run the **`security-review`** skill — this project's threat model (`docs/security.md`) includes OAuth/PKCE correctness and cognitive-data privacy, both worth a dedicated pass beyond normal code review.

### Phase 3+ — Implementation (Web MVP onward, current phase)

- Run **`code-review`** (or **`simplify`** for pure cleanup passes) before considering a chunk of work done, especially anything touching the adaptive engine or scoring calculations — these are the places where a subtle bug becomes a scientific-integrity problem, not just a normal bug.
- For UI/UX work specifically, remember the project's own priority order: UI/UX quality sits above technical architecture in the trade-off list in `project_prompt.txt`. When you're deciding where to spend review time, weight it accordingly.
- Once there's real data to show (progress charts, WPM/comprehension pairs, evidence-level badges), load the **`dataviz`** skill before building any chart — it has specific guidance for building trustworthy, accessible visualizations, which matters extra here since a misleading chart (e.g. a WPM line without its paired comprehension line) is exactly the failure mode `docs/product-requirements.md` warns against.
- For recurring validation passes (e.g. "re-run the prohibited-claims copy check every time UI copy changes"), consider **`/loop`** rather than remembering to ask manually each time.
- **Verify every new exercise screen in a real browser before calling it done.** Claude-in-Chrome is the first thing to try; when it won't connect (it hasn't yet, either time this has come up), fall back to a real Playwright spec in `apps/web/e2e/` run against a production build (`next build && next start`) — that's what caught the dev-mode CSRF race and is the pattern both N-Back and Complex Span followed. Passing `typecheck`/`build`/`lint` proves the server-rendered shell is correct, not that timers, event listeners, or a multi-step client-side flow actually work.

### Phase 7 — Monetization

- When implementing the paywall, treat `docs/monetization-plan.md`'s guardrails as hard requirements to review against, not just inspiration — ask for an explicit review pass checking every paywall/upgrade screen against the "never monetize fear" rules before shipping.

### Phase 8+ — Mobile

- Re-run the ecosystem evaluation in `docs/mobile-plan.md` for real at the start of this phase (a **WebSearch**-backed pass) rather than trusting the recommendation frozen at Phase 0 planning time — the spec explicitly calls this out, and the RN/Expo/Flutter landscape shifts.

---

## 2. Technologies worth learning yourself

Matched to when they'll actually matter, so you're not front-loading things you won't touch for months:

**Already useful, Phase 2 (done):**

- **TypeScript** — the whole stack is TS; if you're going to read/steer any code, this is the one that pays off immediately.
- **Next.js (App Router)** — routing, server components vs. client components, and where timing-sensitive exercise code needs to be client-side (this matters for the reaction-time integrity requirements in `docs/product-requirements.md`).
- **PostgreSQL basics + Prisma** (the ORM already chosen and scaffolded in `packages/db`) — you don't need deep DBA skills, but understanding `packages/db/prisma/schema.prisma` will help you sanity-check migrations and review future schema changes.
- **OAuth 2.0 / OIDC + PKCE, at a conceptual level** — you don't need to implement it yourself, but understanding what "PKCE" and "authorization code flow" mean will let you actually evaluate whether the auth implementation is sound, not just take it on faith.

**Now / Phase 3 (current):**

- **Zod** (or whichever validator is chosen) — worth understanding since it's the boundary between "user input" and "trusted data" throughout the app, which matters a lot for the anti-cheat/data-integrity notes in `docs/security.md`.
- **Tailwind CSS** — enough to read component code and judge whether the design-system tokens in `docs/design-system.md` are actually being used consistently, versus one-off magic values creeping in.
- **Playwright and Vitest, at a reading level** — you don't need to write test suites yourself, but being able to read a failing test and understand what it's asserting will make you much faster at triaging "is this actually broken." Both `apps/web/e2e/n-back.spec.ts` and `apps/web/e2e/complex-span.spec.ts` are good real examples to start from.

**Phase 6:**

- **Basic psychometrics concepts** (reliability, d-prime, near vs. far transfer, effect sizes) — you already have the vocabulary from `docs/evidence-review.md`; deepening it will help you push back intelligently when a "transfer" claim in the UI is drifting from what the underlying data actually supports.

**Phase 7:**

- **Stripe's subscription/webhook model** at a conceptual level — entitlement bugs (a user losing access they paid for, or keeping access they cancelled) are high-trust-cost bugs; understanding the webhook-driven state model will help you spot-check this area specifically.

**Phase 8+:**

- **Expo/React Native fundamentals** — if the Phase 8 evaluation confirms RN+Expo (current recommendation in `docs/mobile-plan.md`), most of your TypeScript/React knowledge carries over directly; the delta is mostly native modules, platform-specific UI conventions, and app-store submission mechanics.

---

## 3. Session/workflow habits specific to this project

- **Treat `docs/kanban.md` as the live source of truth, not `docs/development-plan.md`.** The development plan is phase-level and shouldn't need to change often; the kanban board is where "what's actually next" lives and should be updated as work moves through columns.
- **Every new training exercise is a two-file change, minimum:** an entry in `data/evidence-registry.json` and a matching section in `docs/evidence-review.md`. If you're ever asked to "just add an exercise," push back until the evidence-gating step happens first — this is the project's central scientific-integrity mechanism, and skipping it for speed defeats the point.
- **Use Plan Mode for anything that changes a shared interface** (the `AdaptiveTrainingTask` interface, the database schema, the auth provider model) — these are expensive to change once several exercises/screens depend on them, so the extra planning step pays for itself.
- **Fork for research, don't fork for implementation you want to review closely.** Forking is great for "go read these five meta-analyses and summarize" (keeps noise out of your main context) but implementation work you'll want to review line-by-line is often better done directly in the main session where you're already tracking context.
- **Re-run the "no prohibited claims" check whenever UI copy changes**, not just once at launch — it's cheap (a grep-style scan for IQ/smarter/cure/prevent-style language) and the cost of missing one in shipped copy is a credibility problem, not just a bug.
- **When in doubt about scope, re-read the MVP Philosophy section of `docs/development-plan.md`** — 3-5 outstanding exercises plus reading training beats twenty mediocre ones; this is worth re-anchoring on any time a session starts drifting toward "let's also add..."

## 4. Suggested learning order (matched to the roadmap, not front-loaded)

1. TypeScript + Next.js basics (Phase 2, done — the auth flow and first two exercises are built on these)
2. Postgres + Prisma, OAuth/PKCE concepts (also Phase 2, done — the schema and auth config are in `packages/db` and `apps/web/src/lib/auth.ts`; worth reading those alongside learning the concepts)
3. Zod + Tailwind, enough Playwright/Vitest to read tests (Phase 3, now underway — see `docs/kanban.md`)
4. Psychometrics vocabulary deepening (Phase 6)
5. Stripe subscription model (Phase 7)
6. Expo/React Native (Phase 8, and only after the framework re-evaluation confirms the choice)

Don't front-load Stripe or React Native now — there's no database yet for either to attach to, and the ecosystem evaluation for the latter is explicitly meant to happen fresh at Phase 8, not be decided today.
