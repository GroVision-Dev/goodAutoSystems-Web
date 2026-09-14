import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * 서버 액션·라우트 핸들러 공통 권한 확인.
 * 화면에서 버튼을 숨기는 것은 보안 경계가 아니므로 모든 액션 첫 줄에서 호출한다.
 */

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("로그인이 필요합니다.");
  return session;
}

/** 관리자 + 문자 2단계 인증을 거친 세션 + 정책을 만족하는 비밀번호 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN" || !session.user.mfa) {
    throw new Error("관리자 권한이 필요합니다.");
  }
  if (session.user.weakPassword) {
    throw new Error("관리자 비밀번호를 먼저 변경해 주세요. (마이페이지 > 비밀번호 변경)");
  }
  return session;
}

/**
 * 관리자 화면(레이아웃·페이지)용. 예외 대신 리다이렉트한다.
 * 레이아웃과 페이지는 동시에 렌더링되므로 레이아웃 검사만 믿지 말고 각 페이지에서도 호출한다.
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/optix-dev");
  if (session.user.role !== "ADMIN") redirect("/");
  if (!session.user.mfa) redirect("/mypage?admin=reauth");
  if (session.user.weakPassword) redirect("/mypage?admin=weak-password");
  return session;
}

/** 클라이언트에서 넘어온 id 인자 검증 (문자열·길이) */
export function assertId(value: unknown, label = "id"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new Error(`잘못된 요청입니다. (${label})`);
  }
  return value;
}
