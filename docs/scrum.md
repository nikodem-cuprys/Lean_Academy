# Scrum — LeanAcademy

_Process/methodology document: how work flows and who decides what. Not a second "what's next" board — that stays `docs/kanban.md`'s job. Not a phase roadmap — that's `docs/development-plan.md`. See "How these three files relate" at the bottom. This is a lightweight adaptation for a solo human plus a single AI implementer — there is no team and no invented meetings here, only the parts of Scrum that map onto how this project actually works._

## Roles

**Product Owner (the human)** — makes scope-fork decisions kanban cards can't resolve on their own: full-persistence vs. stub, what's in vs. out of a phase, when a phase is "done enough" to move on. Real precedent: chose the fuller, real-persistence build twice (Baseline/calibration onboarding, Session orchestration) over a stub alternative — see the auto-memory file `scope-preference-full-persistence.md`, which now defaults future forks of this kind toward the fuller option without asking every time.

**Development (Claude Code)** — executes a card end-to-end: implementation, tests, and the browser verification the Definition of Done requires, then writes the Done entry in `docs/kanban.md` itself.

## Sprints

A sprint = one phase-batch of kanban cards, not a fixed time-box — no calendar cadence exists or is needed for a team of one human and one AI. Phase 4 (UX Polish) and Phase 5 (Engagement) are the two real precedents already set: each was broken into a concrete card list in one planning pass before execution started, then worked one card at a time. Future phases follow the same shape.

## Ceremonies (mapped to things that already happen)

- **Sprint Planning** — happens when a phase's Ready/Backlog is empty and the user says "[phase] planning." Output: a concrete card list with real acceptance criteria, dependencies, and complexity, added to `docs/kanban.md`'s Backlog — Phase 5's own breakdown (`docs/kanban.md`, Backlog → Phase 5 — Engagement) is the template to repeat.
- **Sprint Review** — the verification narrative every Done card already carries (browser/Playwright proof, written into the Done entry itself). Nothing new to schedule; it's the last step of the Definition of Done.
- **Retro** — see Retro log below.

## Definition of Ready (Backlog → Ready)

A card may move to Ready only if it has: real, specific acceptance criteria (no "Build frontend"-style vagueness); real named dependencies (or "none"); a Complexity estimate. This is the same bar `docs/kanban.md`'s Card template already states for P0/P1 cards — applied here to every card, not just P0/P1.

## Definition of Done (Ready → Done)

Canonical copy lives in `docs/kanban.md`, directly above its Board section — not duplicated here. In short: real browser verification, full e2e suite green, evidence-gating chain updated together if applicable, non-negotiable content rules spot-checked, `docs/kanban.md` itself updated.

## Retro log

Purpose: short, session-specific lessons that are too narrative or one-off to justify a durable auto-memory entry, without duplicating the auto-memory system at `C:\Users\nikod\.claude\projects\D--LeanAcademy\memory\`.

**Decision rule — which goes where:**
- A **durable, cross-session preference or pattern** that should silently change future default behavior (e.g. "when X is ambiguous, default to Y") → auto-memory (a new file there), the way `scope-preference-full-persistence.md` already does.
- A lesson **specific to one sprint/session, worth a human-readable trail, but that shouldn't silently change future defaults** (e.g. "this audit found a bug class no one had re-checked since an earlier phase — worth a periodic pass, not a standing behavior change") → a dated 1-2 line entry below.

_(no entries yet as of this restructuring)_

## How these three files relate

- `docs/kanban.md` — the live board: what's actually next, right now.
- `docs/development-plan.md` — the phase-level roadmap: what each phase is for and its exit criteria.
- `docs/scrum.md` (this file) — the process: how work flows between the two above, who decides what, and what "done" means.
