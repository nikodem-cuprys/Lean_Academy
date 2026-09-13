// Minimal in-memory sliding-window limiter. Good enough for a single dev
// instance; a real multi-instance deployment needs a shared store
// (Redis, etc.) instead — see docs/security.md's rate-limiting
// requirement, which this only partially satisfies for now (it covers
// the two new endpoints this feature added, not login/register).
const hits = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= max) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}
