import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guard";
import { AUDIT_ACTIONS, logAdminView, type AuditAction } from "@/lib/audit";
import {
  MAX_RANGE_DAYS,
  addDays,
  enumerateDateKeys,
  kstDateKeyToUtc,
  kstDayRange,
  todayKst,
} from "@/lib/analytics";
import { AUDIT_LOG_RETENTION_DAYS } from "@/lib/retention";

export const metadata = { title: "접속기록" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const TAKE = 300;
const DETAIL_MAX = 120;

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

interface SearchParams {
  action?: string;
  actor?: string;
  ip?: string;
  from?: string;
  to?: string;
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

/** UTC → "YYYY-MM-DD HH:mm:ss" (KST) */
function formatKst(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);
}

/** 브라우저·OS 간단 요약 */
function shortAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Whale/.test(ua)
      ? "Whale"
      : /SamsungBrowser/.test(ua)
        ? "Samsung"
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

function actionTone(action: string): string {
  if (/FAILED|BLOCKED|MISMATCH|INVALID/.test(action)) return "bg-red-500/15 text-red-400";
  if (action.startsWith("ADMIN_VIEW_")) return "bg-muted/15 text-muted";
  if (action.startsWith("ADMIN_") || action.startsWith("PAYMENT_")) {
    return "bg-accent-2/15 text-accent-2";
  }
  return "bg-accent/15 text-accent";
}

/** 접속기록 조회 (읽기 전용). 이 화면을 연 기록도 남는다 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAdminPage();
  const params = await searchParams;
  const today = todayKst();

  // 조회 기간 (기본 최근 7일, 최대 90일)
  let to = isValidDateKey(params.to) ? params.to : today;
  let from = isValidDateKey(params.from) ? params.from : addDays(to, -6);
  if (from > to) [from, to] = [to, from];
  if (enumerateDateKeys(from, to).length > MAX_RANGE_DAYS) {
    from = addDays(to, -(MAX_RANGE_DAYS - 1));
  }

  const action =
    params.action && params.action in AUDIT_ACTIONS ? (params.action as AuditAction) : undefined;
  const actor = params.actor?.trim().slice(0, 50) || undefined;
  const ip = params.ip?.trim().slice(0, 64) || undefined;

  await logAdminView(session, "ADMIN_VIEW_AUDIT", { action, actor, ip, from, to });

  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: kstDateKeyToUtc(from), lt: kstDayRange(to).end },
      ...(action ? { action } : {}),
      ...(actor ? { actorUsername: { contains: actor, mode: "insensitive" as const } } : {}),
      ...(ip ? { ip: { contains: ip } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: TAKE,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">접속기록</h1>
          <p className="mt-1 text-xs text-muted">
            {from} ~ {to} · 조회 결과 {logs.length}건
            {logs.length >= TAKE && ` (최근 ${TAKE}건까지 표시 — 조건을 좁혀 주세요)`}
          </p>
        </div>
        <form className="flex w-full flex-wrap gap-2 text-sm lg:w-auto">
          <select name="action" defaultValue={action ?? ""} className={filterClass}>
            <option value="">전체 이벤트</option>
            {Object.entries(AUDIT_ACTIONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="actor"
            defaultValue={actor ?? ""}
            placeholder="행위자 아이디"
            className={`${filterClass} w-32`}
          />
          <input
            name="ip"
            defaultValue={ip ?? ""}
            placeholder="IP"
            className={`${filterClass} w-32`}
          />
          <input
            type="date"
            name="from"
            defaultValue={from}
            max={today}
            aria-label="시작일"
            className={filterClass}
          />
          <input
            type="date"
            name="to"
            defaultValue={to}
            max={today}
            aria-label="종료일"
            className={filterClass}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-normal">일시 (KST)</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">행위자</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">이벤트</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">대상</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">IP</th>
              <th className="px-4 py-3 font-normal">상세</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">브라우저</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  조건에 맞는 기록이 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const detail = log.detail == null ? null : JSON.stringify(log.detail);
                return (
                  <tr key={log.id} className="border-b border-line/50 align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums">
                      {formatKst(log.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {log.actorUsername ? (
                        <span className="font-mono text-xs">{log.actorUsername}</span>
                      ) : (
                        <span className="text-xs text-muted">비회원</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${actionTone(log.action)}`}>
                        {AUDIT_ACTIONS[log.action as AuditAction] ?? log.action}
                      </span>
                      <p className="mt-1 font-mono text-[10px] text-muted">{log.action}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                      {log.targetType ? `${log.targetType}:${log.targetId ?? "-"}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{log.ip ?? "—"}</td>
                    <td className="max-w-80 px-4 py-3">
                      {detail ? (
                        <span className="break-all font-mono text-[11px] text-muted" title={detail}>
                          {detail.length > DETAIL_MAX ? `${detail.slice(0, DETAIL_MAX)}…` : detail}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted" title={log.userAgent ?? undefined}>
                      {shortAgent(log.userAgent)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        로그인·관리자 개인정보 열람·처리·결제 검증 기록입니다. 수정·삭제할 수 없으며{" "}
        {Math.round(AUDIT_LOG_RETENTION_DAYS / 365)}년 보관 후 자동 파기됩니다. 비정상 접근이 없는지 정기적으로
        점검하세요.
      </p>
    </div>
  );
}
