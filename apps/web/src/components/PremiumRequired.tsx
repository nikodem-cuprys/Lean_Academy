import Link from "next/link";

/**
 * Shared honest gate state for a premium-only feature — no
 * prototype/*.dc.html artboard exists for this yet (checked; there's no
 * billing UI in the design canvas at all), so this is built to match the
 * established card shell (rounded-lg border shadow-sm, same as
 * ProgressView's empty states) rather than inventing a new visual
 * pattern. Says plainly that subscriptions aren't purchasable yet rather
 * than showing a dead "Upgrade" button with no real checkout behind it —
 * see docs/kanban.md's "Entitlement system" card: Stripe wiring is a
 * separate, still-blocked card.
 */
export function PremiumRequired({ featureName }: { featureName: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div
        className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm"
        data-testid="premium-required"
      >
        <h1 className="mb-2 font-display text-[17px] font-bold text-text">
          {featureName} is a premium feature
        </h1>
        <div className="mb-4 text-[13px] leading-relaxed text-text-2">
          Subscriptions aren&rsquo;t available yet — check back soon. Your trained exercises, progress, and the
          full science behind them stay free either way.
        </div>
        <Link
          href="/progress"
          className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
        >
          Back to Progress
        </Link>
      </div>
    </div>
  );
}
