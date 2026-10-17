import type { MiddlewareHandler } from 'hono'

export type RateLimitOptions = {
  /** Length of the fixed window in milliseconds. */
  windowMs: number
  /** Maximum requests per key within one window. */
  max: number
  /** Prefix for the bucket key so limiters do not share counters. */
  keyPrefix: string
}

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Fixed-window in-memory rate limiter keyed by client IP. State is per isolate,
 * which is enough to blunt abusive scraping of a single Worker instance.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip')
      ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'local'
    const key = `${options.keyPrefix}:${ip}`
    const now = Date.now()

    let bucket = buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 1000) {
      for (const [bucketKey, entry] of buckets) {
        if (now >= entry.resetAt) buckets.delete(bucketKey)
      }
    }

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      return c.text('Too Many Requests', 429, { 'Retry-After': String(retryAfter) })
    }

    await next()
  }
}
