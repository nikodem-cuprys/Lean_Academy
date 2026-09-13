# Design System — LeanAcademy

_Phase 1 (UX Foundation) draft. Defines the visual/interaction language referenced by `docs/ux-strategy.md`. Implementation-ready tokens (actual hex/rem values) should be finalized during Phase 2 alongside the chosen component library, but the structure and rules below should not change lightly once set._

## Brand direction

Premium consumer app, not clinical software. Explicit anti-references from `project_prompt.txt`: not university research software, not an old IQ-test website, not a spreadsheet, not a medical dashboard. Closer references: modern fitness apps (progress that feels earned), modern learning apps (clarity, short focused sessions), modern habit apps (streaks done kindly). Feel: effortless, polished, premium, motivating, modern, fast, responsive, satisfying, focused.

## Design tokens

- **Color:** a neutral, low-saturation base (surfaces, text, borders) plus a small set of purposeful accent colors — one primary action color, one success/positive color, one caution color (used sparingly, e.g. streak-at-risk, never punitive), and per-domain accent colors for the training categories (working memory / reading / spatial) used consistently in icons, charts, and progress rings so a user learns to recognize a domain by color. Must pass WCAG AA contrast in both light and dark themes and remain distinguishable under common color-blindness types (avoid red/green as the only differentiator anywhere, including exercise feedback).
- **Typography:** one primary UI typeface optimized for screen legibility at small sizes, plus a distinct, highly legible typeface for reading-training passages (reading mode typography is a separate, more configurable system — see below). Type scale follows a consistent ratio (not ad hoc pixel values) across headline/body/caption tiers.
- **Spacing:** a single spacing scale (e.g. 4px base unit) used everywhere — component padding, layout gutters, gaps — so density stays consistent across screens designed at different times.
- **Radius / elevation:** consistent corner-radius scale and a small number of elevation levels (flat, raised card, modal) rather than arbitrary shadows per component.
- **Motion:** a small set of named durations/easings (e.g. `micro` for button feedback, `transition` for route/screen changes, `celebration` for personal-best/level-up moments) rather than per-component timing values.

## Typography system

- Body/UI text: legible at small sizes, generous line height for scanability.
- Reading-training text: independently adjustable font size, line spacing, and column width (per the spec's accessibility requirement), with a small set of curated font choices rather than unlimited customization — except during standardized baseline/assessment passages, where display conditions are held constant so comparisons across sessions stay valid.
- Numerals (scores, WPM, streak counts) use tabular/lining figures so numbers don't jitter in width as they update.

## Spacing system

4px base unit; a constrained scale (4/8/12/16/24/32/48/64) applied consistently via design tokens/CSS variables, not hardcoded per-component values, so the whole product can be retuned centrally.

## Component library (initial inventory)

Buttons (primary/secondary/tertiary, with a clear single-primary-action convention per screen), cards, progress rings/bars, streak indicator, achievement badge, level/difficulty selector (Beginner/Intermediate/Advanced/Expert/Custom + Auto), exercise stimulus container (isolated from decorative chrome for timing integrity), session progress indicator (exercise 1 of 3, etc.), comprehension question card, WPM+comprehension paired stat display (never shown separately), science evidence-level badge (Strong/Moderate/Limited/Experimental/Unsupported, each with a distinct, non-alarming visual treatment), paywall/upgrade card, modal, toast/inline feedback.

## Interaction patterns

- One obvious primary action per screen; secondary actions visually subordinate.
- Consistent placement of "back"/"skip"/"continue" across the whole onboarding and training flow.
- Exercise-to-exercise transitions are lightweight and fast — no full page reloads, no return-to-menu detour (see `docs/ux-strategy.md` training flow).
- Errors and empty states use plain language, never blame the user, and always offer a next action.

## Animation rules

- Feedback animations scale to the significance of the event: a correct-answer micro-animation is subtle; a personal-best or level-up gets a genuine celebration moment. Do not exaggerate scientifically meaningless improvements with celebration-tier animation (see `project_prompt.txt` FEEDBACK section).
- Decorative animation must never run during a timed stimulus window in reaction-time tasks — measured-stimulus rendering is isolated from decorative UI per the timing-integrity requirement in `docs/product-requirements.md`.
- Full `prefers-reduced-motion` support: every celebratory/decorative animation has a reduced or instant fallback that preserves the *information* (e.g. "New personal best" text/badge) without the motion.

## Accessibility rules

Keyboard navigation across the whole app; screen-reader support wherever task mechanics allow (some timed visual/spatial tasks are inherently visual — document those exceptions explicitly rather than silently failing accessibility); high-contrast mode; reduced motion; font scaling that doesn't break layout; color-blind-safe palettes everywhere, including exercise-specific feedback colors.

## Light / dark themes

Both are first-class, not a dark-mode afterthought. Domain accent colors, evidence-level badge colors, and chart palettes are defined per-theme (not just inverted) so contrast and meaning hold in both.

## Illustration / icon system

A small, consistent icon set (outline or filled, one style only) for navigation and domain categories; illustration (if used at all — onboarding, empty states) stays abstract/geometric rather than literal "brain" imagery, consistent with avoiding the neuroscience-cliche look the anti-references call out.
