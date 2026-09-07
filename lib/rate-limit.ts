/**
 * 프로세스 메모리 기반 고정 윈도우 제한.
 * 단일 컨테이너 운영이라 충분하다. 재시작하면 초기화된다.
 */
const buckets = new Map<string, number[]>();
const CLEANUP_THRESHOLD = 10_000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; retryAfterSeconds: number } {
  const since = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > since);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterMs = hits[0] + windowMs - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > CLEANUP_THRESHOLD) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => t > since)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** 리버스 프록시 뒤에서 실제 클라이언트 IP. 없으면 "unknown" */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
