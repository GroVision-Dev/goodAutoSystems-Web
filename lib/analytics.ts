/**
 * 홈페이지 접속 통계 유틸리티.
 * 수집(/api/track)과 관리자 통계 화면에서 공통으로 사용한다.
 */

/** 방문자 식별 쿠키 이름 (httpOnly, 1년) */
export const VISITOR_COOKIE = "optix_vid";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 통계 조회 최대 기간(일) */
export const MAX_RANGE_DAYS = 90;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 기록하지 않는 경로 접두어 */
const EXCLUDED_PREFIXES = ["/optix-dev", "/api", "/_next"];
const EXCLUDED_EXACT = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);

const BOT_PATTERN =
  /bot|crawl|spider|slurp|yeti|daum|kakaotalk-scrap|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|preview|headless|phantom|puppeteer|playwright|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python-requests|httpclient|go-http-client|java\/|okhttp|axios\/|node-fetch|scrapy/i;

/**
 * IP를 마스킹한다. IPv4는 뒤 두 옥텟, IPv6는 앞 세 그룹 이후를 가린다.
 * x-forwarded-for처럼 쉼표 목록이면 첫 항목(원 클라이언트)을 사용한다.
 */
export function maskIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.split(",")[0].trim();
  if (!ip) return null;

  // IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) ip = mapped[1];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [a, b] = ip.split(".");
    return `${a}.${b}.xx.xx`;
  }
  if (ip.includes(":")) {
    const groups = ip.split(":").filter((g) => g !== "");
    if (groups.length < 2) return null;
    return `${groups.slice(0, 3).join(":")}:xxxx`;
  }
  return null;
}

/** 크롤러·자동화 도구 User-Agent 판별. UA가 없으면 봇으로 본다 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return BOT_PATTERN.test(ua);
}

/** 기록 대상 경로인지 확인한다 */
export function shouldTrackPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (EXCLUDED_EXACT.has(path)) return false;
  return !EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** 쿼리·해시 제거, 끝 슬래시 정리, 200자 제한 */
export function normalizePath(path: string): string {
  let p = path.split(/[?#]/)[0];
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "") || "/";
  return p.slice(0, 200);
}

export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.slice(0, 255);
}

/** UTC 시각 → 한국(KST) 날짜 키 YYYY-MM-DD */
export function toKstDateKey(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 시각 HH:mm */
export function toKstTime(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/** 날짜 키의 하루(KST 00:00 ~ 다음날 00:00)를 UTC Date 범위로 돌려준다 */
export function kstDayRange(dateKey: string): { start: Date; end: Date } {
  const start = kstDateKeyToUtc(dateKey);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** 날짜 키(KST 자정)를 UTC Date로 바꾼다. 형식이 잘못되면 예외 */
export function kstDateKeyToUtc(dateKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) throw new Error(`잘못된 날짜: ${dateKey}`);
  const [, y, mo, d] = m;
  const utcMidnight = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const check = new Date(utcMidnight);
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(mo) - 1 ||
    check.getUTCDate() !== Number(d)
  ) {
    throw new Error(`잘못된 날짜: ${dateKey}`);
  }
  return new Date(utcMidnight - KST_OFFSET_MS);
}

/** 날짜 키에 일수를 더한다 */
export function addDays(dateKey: string, days: number): string {
  const base = kstDateKeyToUtc(dateKey);
  return toKstDateKey(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
}

/** 오늘(KST) 날짜 키 */
export function todayKst(): string {
  return toKstDateKey(new Date());
}

/** 익명 방문자 ID 표시용 축약 */
export function shortVisitorId(visitorId: string): string {
  return visitorId.slice(0, 8);
}

/** 두 날짜 키 사이의 모든 날짜 키 (시작·끝 포함, 오름차순) */
export function enumerateDateKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let cur = from;
  for (let i = 0; i <= MAX_RANGE_DAYS && cur <= to; i++) {
    keys.push(cur);
    cur = addDays(cur, 1);
  }
  return keys;
}
