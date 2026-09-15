/**
 * 프로세스 메모리 기반 고정 윈도우 제한.
 * 단일 컨테이너 운영이라 충분하다. 재시작하면 초기화된다.
 */
const buckets = new Map<string, number[]>();
const CLEANUP_THRESHOLD = 10_000;
/** recordHit으로만 쌓는 키의 최대 보관 건수 */
const MAX_HITS_PER_KEY = 100;

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

/** 요청을 소모하지 않고 한도 초과 여부만 확인 (실패 횟수 누적형 제한에 사용) */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { limited: boolean; retryAfterSeconds: number } {
  const since = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > since);
  if (hits.length < limit) return { limited: false, retryAfterSeconds: 0 };
  const retryAfterMs = hits[hits.length - limit] + windowMs - now;
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** 한도 판정 없이 1건 기록 (예: 로그인 실패) */
export function recordHit(key: string, now: number = Date.now()) {
  const hits = buckets.get(key) ?? [];
  hits.push(now);
  buckets.set(key, hits.slice(-MAX_HITS_PER_KEY));
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function resetRateLimits() {
  buckets.clear();
}

type HeaderSource = Request | { get(name: string): string | null };

/**
 * 리버스 프록시(nginx) 뒤에서 실제 클라이언트 IP. 없으면 "unknown".
 * X-Forwarded-For의 첫 값은 클라이언트가 임의로 넣을 수 있으므로 신뢰하지 않는다.
 * nginx가 덮어쓰는 X-Real-IP를 우선하고, 없으면 X-Forwarded-For의 마지막 값(프록시가 붙인 값)을 쓴다.
 */
export function getClientIp(source: HeaderSource): string {
  // next/headers의 headers() 결과는 내부에 headers 속성이 따로 있으므로, get 메서드 유무로 구분한다
  const headers =
    typeof (source as { get?: unknown }).get === "function"
      ? (source as { get(name: string): string | null })
      : (source as Request).headers;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}
