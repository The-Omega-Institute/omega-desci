type Bucket = {
  resetAtMs: number;
  count: number;
};

type RateLimitState = {
  buckets: Map<string, Bucket>;
};

function state(): RateLimitState {
  const g = globalThis as typeof globalThis & { __omegaRateLimit?: RateLimitState };
  if (!g.__omegaRateLimit) g.__omegaRateLimit = { buckets: new Map() };
  return g.__omegaRateLimit;
}

function clientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "local";
}

export function applyRateLimit(request: Request, opts: { key: string; limit: number; windowMs: number }) {
  const now = Date.now();
  const ip = clientIp(request);
  const bucketKey = `${opts.key}:${ip}`;

  const st = state();
  const current = st.buckets.get(bucketKey);
  const bucket: Bucket = current && current.resetAtMs > now ? current : { resetAtMs: now + opts.windowMs, count: 0 };

  bucket.count += 1;
  st.buckets.set(bucketKey, bucket);

  const allowed = bucket.count <= opts.limit;
  const remaining = Math.max(0, opts.limit - bucket.count);

  return {
    allowed,
    limit: opts.limit,
    remaining,
    resetAt: new Date(bucket.resetAtMs).toISOString(),
    ip,
  };
}

