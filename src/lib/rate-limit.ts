// In-memory sliding-window rate limiter (one process; resets on restart). Used by the agent door and the buyer console.

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
