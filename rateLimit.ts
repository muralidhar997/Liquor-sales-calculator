// Very simple in-memory rate limiting for demo.
// On serverless deployments this is best-effort only.
// Consider Upstash/Redis later if you need stronger limits.

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now > e.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (e.count >= limit) return { ok: false, remaining: 0 };
  e.count += 1;
  store.set(key, e);
  return { ok: true, remaining: limit - e.count };
}
