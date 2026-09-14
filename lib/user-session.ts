import { prisma } from "@/lib/prisma";

/**
 * 웹 로그인 세션 저장소.
 * JWT 쿠키에는 세션 id만 넣고, 매 요청마다 이 테이블에서 폐기·만료 여부를 확인한다.
 * → 로그아웃·비밀번호 변경·정지 시 서버에서 즉시 무효화할 수 있다.
 */

/** 절대 만료 시간 (로그인 후 연장되지 않음) */
export const SESSION_MAX_AGE_SECONDS = {
  USER: 3 * 24 * 60 * 60,
  ADMIN: 8 * 60 * 60,
} as const;

/** 쿠키(JWT) 최대 수명 — 세션 행 만료 중 가장 긴 값과 맞춘다 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS.USER;

export async function createUserSession(params: {
  userId: string;
  role: "USER" | "ADMIN";
  mfa: boolean;
  weakPassword: boolean;
  ip: string | null;
  userAgent: string | null;
}) {
  const maxAge = SESSION_MAX_AGE_SECONDS[params.role];
  return prisma.userSession.create({
    data: {
      userId: params.userId,
      mfa: params.mfa,
      weakPassword: params.weakPassword,
      ip: params.ip && params.ip !== "unknown" ? params.ip.slice(0, 64) : null,
      userAgent: params.userAgent?.slice(0, 255) ?? null,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });
}

/** 회원의 활성 세션을 모두 폐기한다. exceptSessionId를 주면 그 세션(현재 기기)은 남긴다 */
export async function revokeUserSessions(
  userId: string,
  options: { exceptSessionId?: string } = {}
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
