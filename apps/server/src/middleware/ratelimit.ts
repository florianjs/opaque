import { createMiddleware } from "hono/factory";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const LIMIT = 100;
const WINDOW_MS = 60_000; // 1 minute

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, WINDOW_MS);

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (entry.count >= LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header("retry-after", String(retryAfter));
    c.header("x-ratelimit-limit", String(LIMIT));
    c.header("x-ratelimit-remaining", "0");
    return c.json({ error: "opaque: rate_limit_exceeded" }, 429);
  }

  entry.count += 1;
  c.header("x-ratelimit-limit", String(LIMIT));
  c.header("x-ratelimit-remaining", String(LIMIT - entry.count));

  return next();
});
