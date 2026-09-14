import { prisma } from "@/lib/prisma";

/**
 * 개인정보 보유기간 경과 데이터 파기.
 * 개인정보처리방침(/privacy)의 보유 기간과 반드시 일치시킨다. 정기 작업에서 호출한다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 접속 통계(PageView): 1년 */
export const PAGE_VIEW_RETENTION_DAYS = 365;
/** 도입 문의: 처리 완료(DONE) 후 1년 */
export const INQUIRY_RETENTION_DAYS = 365;
/** 보안 접속기록(AuditLog): 2년 (안전성 확보조치 기준 최소 1년 이상) */
export const AUDIT_LOG_RETENTION_DAYS = 730;
/** 로그인 세션: 만료·폐기 후 30일 */
export const SESSION_RETENTION_DAYS = 30;
/** 휴대폰 인증번호·관리자 로그인 인증번호: 만료 후 1일 */
export const VERIFICATION_RETENTION_DAYS = 1;

export async function runRetentionCleanup(now: Date = new Date()): Promise<Record<string, number>> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const sessionCutoff = before(SESSION_RETENTION_DAYS);
  const verificationCutoff = before(VERIFICATION_RETENTION_DAYS);

  const [pageViews, inquiries, auditLogs, sessions, phoneVerifications, loginOtps] =
    await Promise.all([
      prisma.pageView.deleteMany({
        where: { createdAt: { lt: before(PAGE_VIEW_RETENTION_DAYS) } },
      }),
      prisma.inquiry.deleteMany({
        where: { status: "DONE", updatedAt: { lt: before(INQUIRY_RETENTION_DAYS) } },
      }),
      prisma.auditLog.deleteMany({
        where: { createdAt: { lt: before(AUDIT_LOG_RETENTION_DAYS) } },
      }),
      prisma.userSession.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: sessionCutoff } }, { revokedAt: { lt: sessionCutoff } }],
        },
      }),
      prisma.phoneVerification.deleteMany({
        where: { expiresAt: { lt: verificationCutoff } },
      }),
      prisma.loginOtp.deleteMany({
        where: { expiresAt: { lt: verificationCutoff } },
      }),
    ]);

  return {
    pageViews: pageViews.count,
    inquiries: inquiries.count,
    auditLogs: auditLogs.count,
    sessions: sessions.count,
    phoneVerifications: phoneVerifications.count,
    loginOtps: loginOtps.count,
  };
}
