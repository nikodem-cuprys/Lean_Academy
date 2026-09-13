/**
 * Placeholder package — not yet implemented.
 *
 * Will hold the shared stimulus/trial-timing runtime used by every
 * reaction-time exercise: performance.now()-based stimulus/response
 * timestamps, page-visibility and focus-loss detection, and the
 * separation of decorative UI from measured stimulus rendering. See
 * "SCIENTIFIC TASK TIMING" in project_prompt.txt and the timing-
 * integrity requirement in docs/product-requirements.md.
 *
 * The Trial model in packages/db's Prisma schema (wasInterrupted,
 * stimulusStartedAt/respondedAt) is designed to receive this package's
 * output directly.
 */
export const TRIAL_ENGINE_PLACEHOLDER = true;
