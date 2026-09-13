# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

LeanAcademy is a scientifically-grounded cognitive-training platform (working memory + reading-efficiency training), currently in **Phase 0/1 (Research & Planning / UX Foundation)** per `docs/development-plan.md`. There is no application code yet — no package.json, no build system, no tests. The repository currently holds:

- the full research/product/planning documentation set the project requires before implementation begins;
- an interactive design-canvas prototype under `prototype/` (static Design Component HTML — a visual mockup, not application code).

Full original product spec: `project_prompt.txt`. Do not assume a Next.js/React app exists — check `docs/kanban.md`'s "Ready (Phase 2 — Technical Foundation)" section for the planned repo scaffold before adding build tooling.

## Commands

None yet. There is nothing to build, lint, or test until Phase 2 scaffolds a real codebase — update this section with real commands once that happens.

The one generated artifact in the repo is `prototype/lean-academy-prototype.html`. It's produced from `prototype/*.dc.html` + `prototype/canvas.json` via the Claude Code `design` skill's seed step — don't hand-edit it directly; edit the source `.dc.html`/`canvas.json` files and reseed/republish through the `design` skill.

## Architecture

### The evidence-gating chain (the project's central mechanic)

Every training exercise is traceable through two linked, must-stay-in-sync files:

1. `docs/evidence-review.md` — narrative literature review per training domain: evidence quality, trained-task improvement vs. near transfer vs. far transfer (kept strictly separate), studied population, limitations, citations.
2. `data/evidence-registry.json` — the machine-readable mirror (`modules[]`, each keyed by a `method` id like `adaptive-nback-v0`, carrying `evidenceLevel`, `trainedTaskImprovement`/`nearTransfer`/`farTransfer`, `productionApproved`, `citations`). The rule is that only `productionApproved: true` modules may ever load in the production exercise catalog.

**Adding, changing, or excluding a training method requires updating both files together, in the same change** — never one without the other. Two modules are deliberately `productionApproved: false` (`inhibition-flanker-gonogo-v0`, `rsvp-single-word-v0`, evidence reviewed in `docs/evidence-review.md` §6 and §10) — don't flip these without a real literature pass, not just an editorial decision.

`docs/product-requirements.md` and `docs/kanban.md` reference registry entries by their `method` id, so renaming one means updating references elsewhere too.

### Documentation map

- `README.md` — entry point and full doc index.
- `docs/product-requirements.md` — vision, users, requirements, metrics, scientific claim limits.
- `docs/evidence-review.md` + `data/evidence-registry.json` — see above.
- `docs/ux-strategy.md` — user journeys, information architecture, the critical-path screen list the prototype implements.
- `docs/design-system.md` — tokens, typography, motion, accessibility rules the prototype follows.
- `docs/development-plan.md` — the Phase 0–10 roadmap; check this before assuming what stage of work is appropriate for a given request.
- `docs/kanban.md` — the live "what's next" board; more current than the development plan for day-to-day priority, and the source of the first executable Phase 2 cards.
- `docs/mobile-plan.md`, `docs/monetization-plan.md`, `docs/security.md`, `docs/testing.md` — later-phase plans, already drafted ahead of need.
- `env_development.md` — operator-facing guide to which Claude Code skills/subagents fit which project phase; read before starting non-trivial work here.

### Non-negotiable content rules (apply to any doc, copy, or future code change)

- Never let copy claim IQ increase, general intelligence gain, dementia prevention, ADHD cure, or similar unsupported outcomes — see "SCIENTIFIC PROGRESS LANGUAGE" in `project_prompt.txt` and the Scientific Honesty section of `docs/product-requirements.md`.
- Keep trained-task gains, near transfer, and far transfer as three separate, never-conflated concepts wherever they appear (docs, data, UI copy).
- Reading-related copy or metrics must never show WPM without its paired comprehension figure alongside it.

### `prototype/` (design canvas)

Self-contained `*.dc.html` "Design Component" artboards — one per screen (landing, auth, three onboarding steps, calibration, level select, home in mobile/desktop/dark variants, six-plus exercise types, results, progress in mobile/desktop, science, achievements, a design-tokens reference sheet) — plus `canvas.json` (the layout manifest) and the generated `lean-academy-prototype.html`. Each `.dc.html` file is fully independent: there is no shared runtime state or imported stylesheet between artboards, so a token or component change has to be applied by hand to every file that uses it (search for the CSS variable or class name across `prototype/*.dc.html`).

### Suggested (not yet implemented) tech direction

Per `docs/development-plan.md`'s reference architecture: Next.js, React, TypeScript, PostgreSQL, Drizzle or Prisma, Zod, Tailwind CSS, Playwright, Vitest — as a monorepo separating `apps/{web,api,mobile}` from `packages/{cognitive-engine,reading-engine,trial-engine,adaptive-engine,psychometrics,evidence,design-system,shared}`. None of this exists yet; confirm with the user before scaffolding it.
