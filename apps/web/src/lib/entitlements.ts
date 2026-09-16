import { prisma } from "@lean-academy/db";

/**
 * Real entitlement check against packages/db/prisma/schema.prisma's
 * (previously unused) Subscription model, ahead of any real billing
 * integration — see docs/kanban.md's "Entitlement system + honest
 * free/premium split" card. A user with no Subscription row at all
 * (everyone today, since nothing has ever written one) is FREE, the
 * same default the schema itself declares for `plan`.
 *
 * PAST_DUE counts as still-entitled: Stripe's own recommended pattern
 * is a grace period while a renewal payment retries, not an instant
 * cutoff — this only decides feature access, not billing, so treating a
 * likely-transient payment hiccup as an immediate hard lockout would be
 * a worse user experience than the small risk of a few extra days of
 * access before Stripe finally cancels a truly-dead subscription.
 */
const ENTITLED_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

export async function isPremiumUser(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (!subscription || subscription.plan === "FREE") return false;
  return ENTITLED_STATUSES.has(subscription.status);
}
