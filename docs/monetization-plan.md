# Monetization Plan — LeanAcademy

_Phase 7 planning, prepared early per spec instruction to research and design monetization before implementing any paywall. The overriding constraint: the monetization strategy must protect scientific credibility — never monetize fear, never hide basic scientific limitations behind a subscription, never imply training effectiveness itself is gated by payment._

**Status:** Still accurate as a Phase 7 early-prepared plan — no implementation has started, nothing to reconcile yet.

## Guardrails (non-negotiable, from `project_prompt.txt`)

- Never: "Your brain is declining — pay to fix it."
- Never: "Your memory score is hidden until you pay."
- Science/evidence explanations are never premium-gated — users must always be able to verify product claims for free.
- Cancellation must be exactly as easy as subscribing; no intentionally confusing cancellation flow.
- Premium unlocks personalization, content breadth, analytics depth, advanced modes, convenience, and customization — not the core effectiveness of training itself.

## Proposed freemium structure (to validate against competitor research before finalizing prices)

**Free:** the core daily session, several exercises (enough to represent each trained construct — WM updating, WM span, reading — not a crippled single-exercise demo), basic reading training, basic progress view, full science/evidence information, limited historical analytics (e.g. last 30 days).

**Premium:** complete training library (all evidence-approved modules as the catalog grows), advanced adaptive plans, full progress history, transfer assessments (Phase 6), advanced reading analytics, personalized training plans, deeper statistics, additional themes, more training modes, advanced mobile features (Phase 8+).

## Subscription options

Monthly and annual (annual at a discount), with a free trial that has a clear, honest cancellation path — never a trial designed to be forgotten into an unwanted charge. Exact price points require competitor research (see Open Questions below) before being set; do not invent numbers without that research.

## Lifetime plan

Not automatically offered. Evaluate against modeled long-term costs: hosting, support, ongoing research/evidence-review upkeep, app-store fees, and future development — a lifetime price only makes sense once these are estimated, which requires real infrastructure-cost data from Phase 2/3, not this early.

## Family plan (later feature)

Multiple independent profiles under one subscription; cognitive-performance data must not be shared between family members without explicit permission from each profile owner — treat it as a privacy boundary, not just a billing convenience.

## B2B possibilities (later, evaluate not implement)

Education, corporate learning/wellbeing, research institutions. Explicitly do not position the product as a clinical assessment tool without appropriate validation and regulatory review — this applies doubly in a B2B/institutional context where the bar for that kind of claim is higher.

## Payments infrastructure

Web: Stripe (or an equivalent evaluated at implementation time) for subscription billing. Mobile: comply with current Apple App Store and Google Play billing rules — verify current requirements at implementation time rather than trusting this document, since these rules change. Keep entitlements synchronized across web/iOS/Android wherever platform rules permit (a subscriber shouldn't lose premium access switching devices).

## Monetization analysis framework (structure now, populate with real numbers later)

- **Customer segments:** consistency seeker, improver, skeptic, efficiency reader (from `docs/product-requirements.md`) — likely differing conversion and churn profiles; instrument separately once there's usage data.
- **Free-to-paid funnel:** unknown until Phase 3 usage data exists — do not invent a conversion rate.
- **Premium value proposition:** breadth + depth + personalization + convenience, articulated per persona rather than one generic pitch.
- **Infrastructure cost categories:** hosting/compute, database, auth/identity provider fees, payment processing fees, app-store fees (15-30% range depending on platform/tier — verify current rates at implementation time), content/research maintenance (evidence-review upkeep is an ongoing cost, not one-time).
- **Retention assumptions:** unknown until real D1/D7/D30 data exists (see `docs/product-requirements.md` Metrics) — mark explicitly unknown rather than assumed.
- **Pricing experiments:** plan for A/B testing of price points and paywall presentation once there's enough traffic to power a test (see `docs/testing.md` / A/B testing notes) — never A/B test the underlying training algorithm's scientific validity as if it were a UX variable (see `project_prompt.txt` A/B TESTING section).
- **Churn / LTV / CAC:** framework only at this stage; every variable is unknown until real acquisition and retention data exists. Do not backfill with invented industry-average numbers presented as this product's numbers.
- **Break-even methodology:** once infrastructure and CAC are real numbers (post-launch), break-even = fixed costs + variable cost per user vs. (price - payment fees - app-store fees) x conversion rate x active user count; revisit this doc with actual figures at that point.

## Open questions requiring competitor/market research before finalizing (do not guess)

- Actual price points of comparable cognitive-training and reading-training products, and how their free/premium splits are structured.
- Whether a lifetime plan is common/expected in this category or actively discouraged by unit economics elsewhere in the space.
- Typical app-store fee tier the product would qualify for (small-business programs on both major app stores offer reduced rates below a revenue threshold).
