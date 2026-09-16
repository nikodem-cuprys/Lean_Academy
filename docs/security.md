# Security & Privacy Plan — LeanAcademy

_Phase 2 requirement, drafted early. Cognitive-performance data is sensitive: it can reveal information about a person's cognitive function over time, so this gets treated with the same care as health-adjacent data even though it isn't a clinical record._

**Status:** Drafted in Phase 2 as a strategy document; not yet revisited line-by-line against the real implementation. Most of Authentication above is real and shipped (see `CLAUDE.md`'s Auth data model / Email verification sections and `docs/kanban.md`'s Done entries) — one item remains genuinely open and is tracked as a Backlog card in `docs/kanban.md`: the real Google/Facebook OAuth redirect is unverified (needs real provider credentials). Rate limiting now covers all four auth endpoints named below (login, register, forgot-password, reset-password) — still in-memory/single-instance only, not yet the shared store a multi-instance deployment would need. Password reset now invalidates sessions on other devices too, despite the JWT strategy having no server-side session store (see `CLAUDE.md`'s Email verification & password reset section for the mechanism).

## Authentication

- Email + password: passwords hashed with a modern adaptive algorithm (bcrypt/argon2, never reversible encryption or fast general-purpose hashes), email verification required before full account trust, secure forgotten-password flow (time-limited, single-use tokens; never emailing the password itself).
- Google and Facebook: official OAuth/OIDC flows only, with PKCE. The app must never ask a user for their Gmail/Facebook password directly.
- `Identity`/`AuthProvider` model (see `docs/product-requirements.md`) supports linking multiple providers to one account without creating duplicates, and is designed to accept new providers later without a schema rewrite.
- Sessions: secure, httpOnly, SameSite cookies; short-lived access tokens with refresh where applicable; session invalidation on password change and on explicit logout everywhere.

## Application security

- CSRF protection on all state-changing requests where cookie-based sessions are in play.
- Input validation at every boundary using a schema validator (Zod, per the suggested stack) — never trust client-supplied difficulty parameters, scores, or trial data without server-side validation and plausibility checks (a client claiming an impossible reaction time should be rejected/flagged, not silently recorded).
- Rate limiting on auth endpoints (login, password reset, registration) and on any endpoint that writes scientific trial data, to prevent both credential-stuffing and fabricated-data abuse.
- Authorization checks on every resource access — a user must never be able to read or write another user's training data, profile, or entitlements by manipulating an ID.
- Secrets (OAuth client secrets, database credentials, payment API keys) never ship in frontend code or client-visible bundles; environment-variable/secret-manager only, server-side.
- Encrypted transport (TLS) everywhere, no exceptions for internal-seeming traffic.

## Data privacy

- Account deletion: full, verifiable deletion of personal data and training history on request, not just a soft "deactivated" flag that retains everything.
- Data export: a user can export their own training history in a usable format (e.g. JSON/CSV) at any time.
- Privacy settings: cognitive-performance data is never exposed on a public-facing profile; any future social/league feature (Phase 10) must be designed around aggregate, non-identifying, or opt-in-only comparisons — never a default-public "intelligence ranking" (explicitly prohibited in `project_prompt.txt`).
- No individual cognitive-performance record is ever sold. If aggregate/anonymized research use is ever considered (Phase 10 "research participation" is opt-in per the spec), it requires explicit, separate, revocable consent — never bundled into general terms of service.
- Family plan (later feature): each profile's cognitive data stays private from other profiles on the same subscription unless that profile owner explicitly shares it.

## Task-integrity security notes

- Server-side validation of trial timing/results prevents a modified client from inflating scores or unlocking difficulty/achievements illegitimately — this is both a data-integrity and an anti-cheat concern once achievements/leaderboards exist.
- Task versioning (`docs/product-requirements.md`) also has a light security dimension: it prevents a client from replaying stale task logic against a newer scoring model.

## Regulatory posture

The product is explicitly not a clinical assessment tool (see `docs/product-requirements.md` Out of Scope) — this keeps it outside medical-device/clinical-software regulatory regimes as currently scoped, but that boundary must be actively maintained (copy, claims, and any future B2B/clinical-adjacent positioning) rather than assumed permanent. Revisit with actual legal counsel before any B2B/institutional or health-adjacent positioning change (see `docs/monetization-plan.md` B2B section).

## Verification (feeds into `docs/testing.md`)

Security-relevant flows that must have explicit test coverage: registration, email verification, login (all three methods), logout, password reset, account linking, account deletion, data export, authorization boundaries (cross-user data access attempts), and rate-limit behavior on auth endpoints.
