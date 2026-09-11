import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  MAX_RANGE_DAYS,
  addDays,
  enumerateDateKeys,
  kstDateKeyToUtc,
  kstDayRange,
  shortVisitorId,
  toKstDateKey,
  toKstTime,
  todayKst,
} from "@/lib/analytics";

export const metadata = { title: "접속 통계" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

interface SearchParams {
  from?: string;
  to?: string;
  date?: string;
}

function isValidDateKey(value: string | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  try {
    kstDateKeyToUtc(value);
    return true;
  } catch {
    return false;
  }
}

function weekdayOf(dateKey: string) {
  // KST 자정의 요일
  return WEEKDAY[new Date(kstDateKeyToUtc(dateKey).getTime() + 9 * 60 * 60 * 1000).getUTCDay()];
}

/** 브라우저·OS 간단 요약 (UA 문자열 → "Chrome · Windows") */
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "알 수 없음";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung"
      : /Whale/.test(ua)
        ? "Whale"
        : /KAKAOTALK/i.test(ua)
          ? "카카오톡"
          : /NAVER/i.test(ua)
            ? "네이버앱"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : /Firefox\//.test(ua)
                  ? "Firefox"
                  : "기타";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "기타";
  return `${browser} · ${os}`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayKst();

  // 조회 기간 결정 (기본 최근 7일, 최대 90일)
  let to = isValidDateKey(params.to) ? params.to : today;
  let from = isValidDateKey(params.from) ? params.from : addDays(to, -6);
  if (from > to) [from, to] = [to, from];
  if (enumerateDateKeys(from, to).length > MAX_RANGE_DAYS) {
    from = addDays(to, -(MAX_RANGE_DAYS - 1));
  }
  const rangeDays = enumerateDateKeys(from, to).length;

  const rangeStart = kstDateKeyToUtc(from);
  const rangeEnd = kstDayRange(to).end;

  const views = await prisma.pageView.findMany({
    where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { createdAt: "asc" },
    select: {
      path: true,
      userId: true,
      visitorId: true,
      ipMasked: true,
      userAgent: true,
      referrer: true,
      createdAt: true,
    },
  });

  // 회원 정보 조회 (기간 내 등장한 회원만)
  const userIds = [...new Set(views.map((v) => v.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  // 일자별 집계
  const daily = new Map<
    string,
    { views: number; visitors: Set<string>; members: Set<string> }
  >();
  for (const key of enumerateDateKeys(from, to)) {
    daily.set(key, { views: 0, visitors: new Set(), members: new Set() });
  }
  const allVisitors = new Set<string>();
  const allMembers = new Set<string>();
  const pathCount = new Map<string, number>();
  const referrerCount = new Map<string, number>();

  for (const v of views) {
    const key = toKstDateKey(v.createdAt);
    const day = daily.get(key);
    const visitorKey = v.userId ? `u:${v.userId}` : `v:${v.visitorId}`;
    if (day) {
      day.views += 1;
      day.visitors.add(visitorKey);
      if (v.userId) day.members.add(v.userId);
    }
    allVisitors.add(visitorKey);
    if (v.userId) allMembers.add(v.userId);
    pathCount.set(v.path, (pathCount.get(v.path) ?? 0) + 1);
    if (v.referrer) referrerCount.set(v.referrer, (referrerCount.get(v.referrer) ?? 0) + 1);
  }

  const dailyRows = [...daily.entries()]
    .map(([date, d]) => ({
      date,
      views: d.views,
      visitors: d.visitors.size,
      members: d.members.size,
    }))
    .reverse();
  const maxViews = Math.max(1, ...dailyRows.map((r) => r.views));
  const todayViews = daily.get(today)?.views ?? views.filter((v) => toKstDateKey(v.createdAt) === today).length;

  const topPages = [...pathCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topReferrers = [...referrerCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 선택 일자 상세 (기본: 기간 내 데이터가 있는 가장 최근 날짜)
  const selectedDate = isValidDateKey(params.date)
    ? params.date
    : dailyRows.find((r) => r.views > 0)?.date ?? to;
  const dayViews = views.filter((v) => toKstDateKey(v.createdAt) === selectedDate);

  interface VisitorRow {
    key: string;
    label: string;
    sub: string;
    isMember: boolean;
    ipMasked: string | null;
    agent: string;
    views: number;
    first: Date;
    last: Date;
    pages: Map<string, number>;
  }
  const visitorRows = new Map<string, VisitorRow>();
  for (const v of dayViews) {
    const key = v.userId ? `u:${v.userId}` : `v:${v.visitorId}`;
    let row = visitorRows.get(key);
    if (!row) {
      const user = v.userId ? userMap.get(v.userId) : undefined;
      row = {
        key,
        label: v.userId ? user?.name ?? "(삭제된 회원)" : `방문자 ${shortVisitorId(v.visitorId)}`,
        sub: v.userId ? user?.username ?? v.userId : "비회원",
        isMember: !!v.userId,
        ipMasked: v.ipMasked,
        agent: summarizeUserAgent(v.userAgent),
        views: 0,
        first: v.createdAt,
        last: v.createdAt,
        pages: new Map(),
      };
      visitorRows.set(key, row);
    }
    row.views += 1;
    if (v.createdAt < row.first) row.first = v.createdAt;
    if (v.createdAt > row.last) {
      row.last = v.createdAt;
      row.ipMasked = v.ipMasked ?? row.ipMasked;
    }
    row.pages.set(v.path, (row.pages.get(v.path) ?? 0) + 1);
  }
  const visitorList = [...visitorRows.values()].sort(
    (a, b) => b.views - a.views || b.last.getTime() - a.last.getTime(),
  );

  const rangeQuery = `from=${from}&to=${to}`;
  const presetActive = (days: number) => to === today && from === addDays(today, -(days - 1));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">접속 통계</h1>
          <p className="mt-1 text-xs text-muted">
            {from} ~ {to} · {rangeDays}일 · 한국 시간 기준 · 관리자 화면과 봇 접속은 제외
          </p>
        </div>
        <form className="flex w-full flex-wrap items-center gap-2 text-sm lg:w-auto">
          <div className="flex gap-1">
            {[7, 30, 90].map((days) => (
              <Link
                key={days}
                href={`/optix-dev/analytics?from=${addDays(today, -(days - 1))}&to=${today}`}
                className={`rounded-lg border px-3 py-2 transition ${
                  presetActive(days)
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line text-muted hover:text-foreground"
                }`}
              >
                {days}일
              </Link>
            ))}
          </div>
          <input
            type="date"
            name="from"
            defaultValue={from}
            max={today}
            aria-label="시작일"
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
          <span className="text-muted">~</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            max={today}
            aria-label="종료일"
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            조회
          </button>
        </form>
      </div>

      {/* 요약 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "총 페이지뷰", value: views.length.toLocaleString() },
          { label: "순 방문자", value: allVisitors.size.toLocaleString(), hint: "회원 + 익명 쿠키 기준" },
          { label: "회원 방문자", value: allMembers.size.toLocaleString(), hint: "로그인 상태로 접속" },
          { label: "오늘 페이지뷰", value: todayViews.toLocaleString(), hint: today },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <p className="text-xs text-muted md:text-sm">{stat.label}</p>
            <p className="mt-1 text-xl font-bold md:text-2xl">{stat.value}</p>
            {stat.hint && <p className="mt-1 text-[11px] text-muted">{stat.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 일자별 */}
        <div className="rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-bold">일자별 접속</h2>
            <p className="mt-0.5 text-xs text-muted">날짜를 누르면 아래에서 방문자 상세를 볼 수 있습니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="whitespace-nowrap px-5 py-3 font-normal">날짜</th>
                  <th className="w-full px-3 py-3 font-normal">페이지뷰</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-normal">순 방문자</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-normal">회원</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => {
                  const active = row.date === selectedDate;
                  return (
                    <tr
                      key={row.date}
                      className={`border-b border-line/50 ${active ? "bg-accent/5" : ""}`}
                    >
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <Link
                          href={`/optix-dev/analytics?${rangeQuery}&date=${row.date}#detail`}
                          className={`hover:underline ${active ? "font-medium text-accent" : ""}`}
                        >
                          {row.date}
                          <span className="ml-1 text-xs text-muted">({weekdayOf(row.date)})</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-accent/70"
                              style={{ width: `${(row.views / maxViews) * 100}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular-nums">
                            {row.views.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.visitors}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-muted">{row.members}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 인기 페이지 · 유입 */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-bold">많이 본 페이지</h2>
            {topPages.length === 0 ? (
              <p className="mt-3 text-sm text-muted">기간 내 기록이 없습니다.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {topPages.map(([path, count], i) => (
                  <li key={path} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-xs text-muted">{i + 1}</span>
                      <span className="truncate font-mono text-xs" title={path}>
                        {path}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{count.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-bold">외부 유입 경로</h2>
            {topReferrers.length === 0 ? (
              <p className="mt-3 text-sm text-muted">외부 유입 기록이 없습니다.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {topReferrers.map(([ref, count]) => (
                  <li key={ref} className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs" title={ref}>
                      {ref.replace(/^https?:\/\//, "")}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 선택 일자 방문자 상세 */}
      <div id="detail" className="mt-8 rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-bold">
              {selectedDate} ({weekdayOf(selectedDate)}) 방문자 상세
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              방문자 {visitorList.length}명 · 페이지뷰 {dayViews.length}건
            </p>
          </div>
          <div className="flex gap-1 text-xs">
            <Link
              href={`/optix-dev/analytics?${rangeQuery}&date=${addDays(selectedDate, -1)}#detail`}
              className="rounded-lg border border-line px-2.5 py-1.5 text-muted transition hover:text-foreground"
            >
              ← 전날
            </Link>
            {selectedDate < today && (
              <Link
                href={`/optix-dev/analytics?${rangeQuery}&date=${addDays(selectedDate, 1)}#detail`}
                className="rounded-lg border border-line px-2.5 py-1.5 text-muted transition hover:text-foreground"
              >
                다음날 →
              </Link>
            )}
          </div>
        </div>
        {visitorList.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">해당 날짜의 접속 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="whitespace-nowrap px-5 py-3 font-normal">방문자</th>
                  <th className="whitespace-nowrap px-3 py-3 font-normal">IP · 환경</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-normal">페이지뷰</th>
                  <th className="whitespace-nowrap px-3 py-3 font-normal">접속 시간</th>
                  <th className="px-5 py-3 font-normal">본 페이지</th>
                </tr>
              </thead>
              <tbody>
                {visitorList.map((row) => {
                  const pages = [...row.pages.entries()].sort((a, b) => b[1] - a[1]);
                  return (
                    <tr key={row.key} className="border-b border-line/50 align-top">
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.label}</span>
                          {row.isMember && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                              회원
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-muted">{row.sub}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">
                        <p className="font-mono">{row.ipMasked ?? "—"}</p>
                        <p className="mt-0.5 text-muted">{row.agent}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.views}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted">
                        {toKstTime(row.first)}
                        {row.first.getTime() !== row.last.getTime() && ` ~ ${toKstTime(row.last)}`}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pages.slice(0, 6).map(([path, count]) => (
                            <span
                              key={path}
                              className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px]"
                              title={path}
                            >
                              {path}
                              {count > 1 && <span className="ml-1 text-muted">×{count}</span>}
                            </span>
                          ))}
                          {pages.length > 6 && (
                            <span className="px-1 text-[11px] text-muted">+{pages.length - 6}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
