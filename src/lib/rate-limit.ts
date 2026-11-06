// In-memory sliding-window rate limiter (one process; resets on restart). Used by the agent door, the buyer console
// and the setup routes (starting shops, retakes, menu readings, item photos and covers).

type Buckets = Map<string, number[]>;
const g = globalThis as unknown as { __shelfieRateLimits?: Buckets };
const buckets = (): Buckets => (g.__shelfieRateLimits ??= new Map());

/** Records a hit and returns true when `key` has had fewer than `limit` allowed hits in the last `windowMs`. */
export function allow(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): boolean {
  const map = buckets();
  const since = nowMs - windowMs;
  const hits = (map.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= limit) {
    map.set(key, hits);
    return false;
  }
  hits.push(nowMs);
  map.set(key, hits);
  if (map.size > 10_000) {
    for (const [k, v] of map) if (!v.some((t) => t > since)) map.delete(k);
  }
  return true;
}

export function resetRateLimits(): void {
  buckets().clear();
}

const HOUR = 60 * 60_000;

/**
 * Per-address limits on starting shops, uploading retakes, live menu readings and item photos or covers (spec §15:
 * they spend the Anthropic key and the disk). The e2e and screenshot servers run with SHELFIE_TEST and
 * start dozens of shops from one address, so they skip these limits.
 */
export const SETUP_RATES = {
  shops: { limit: 10, windowMs: HOUR },
  retakes: { limit: 20, windowMs: HOUR },
  readings: { limit: 20, windowMs: HOUR },
  /** Item photos and shop covers (POST /api/shops/[id]/items/[itemId]/photo, /api/shops/[id]/cover). */
  photos: { limit: 120, windowMs: HOUR },
} as const;

/** Records a setup hit for `ip`; false once the address is over its hourly limit. */
export function allowSetup(kind: keyof typeof SETUP_RATES, ip: string, nowMs: number = Date.now()): boolean {
  if (process.env.SHELFIE_TEST) return true;
  const { limit, windowMs } = SETUP_RATES[kind];
  return allow(`setup-${kind}:${ip}`, limit, windowMs, nowMs);
}
