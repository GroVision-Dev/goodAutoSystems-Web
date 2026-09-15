import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";

/**
 * 보안·개인정보 접속기록.
 * 개인정보의 안전성 확보조치 기준에 따라 관리자의 개인정보 열람·변경과 로그인 이력을 남긴다.
 * 기록 실패가 본 기능을 막지 않도록 예외는 삼키고 콘솔에만 남긴다.
 */

/** 이벤트 코드 → 관리자 화면 표기 */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "로그인 성공",
  LOGIN_FAILED: "로그인 실패",
  LOGIN_BLOCKED: "로그인 차단(시도 초과)",
  LOGOUT: "로그아웃",
  ADMIN_OTP_SENT: "관리자 인증번호 발송",
  ADMIN_OTP_FAILED: "관리자 인증번호 실패",
  PROGRAM_LOGIN_SUCCESS: "프로그램 로그인 성공",
  PROGRAM_LOGIN_FAILED: "프로그램 로그인 실패",
  USER_REGISTERED: "회원가입",
  PROFILE_UPDATED: "회원정보 변경",
  PASSWORD_CHANGED: "비밀번호 변경",
  PASSWORD_CHANGE_FAILED: "비밀번호 확인 실패",
  ACCOUNT_WITHDRAWN: "회원 탈퇴",

  ADMIN_VIEW_DASHBOARD: "관리자 대시보드 열람",
  ADMIN_VIEW_USERS: "회원 목록 열람",
  ADMIN_VIEW_ORDERS: "주문 목록 열람",
  ADMIN_VIEW_INQUIRIES: "문의 목록 열람",
  ADMIN_VIEW_BILLING: "월결제 목록 열람",
  ADMIN_VIEW_ANALYTICS: "접속 통계 열람",
  ADMIN_VIEW_AUDIT: "접속기록 열람",
  ADMIN_VIEW_PAYMENT_REQUESTS: "단건 결제 목록 열람",

  ADMIN_USER_STATUS_CHANGED: "회원 상태 변경",
  ADMIN_USER_ROLE_CHANGED: "회원 권한 변경",
  ADMIN_ORDER_CANCELED: "결제 취소(환불)",
  ADMIN_PRODUCT_SAVED: "상품 저장",
  ADMIN_PRODUCT_TOGGLED: "상품 노출 변경",
  ADMIN_PRODUCT_DELETED: "상품 삭제",
  ADMIN_MONTHLY_FEE_SET: "월 결제 설정",
  ADMIN_INVOICE_CREATED: "청구서 발행",
  ADMIN_INVOICES_GENERATED: "청구서 일괄 생성",
  ADMIN_INVOICE_NOTICE_SENT: "청구서 문자 발송",
  ADMIN_INVOICE_CANCELED: "청구서 취소",
  ADMIN_INVOICE_REOPENED: "청구서 복구",
  ADMIN_INQUIRY_UPDATED: "문의 처리 변경",
  ADMIN_INQUIRY_DELETED: "문의 삭제",
  ADMIN_PAYMENT_REQUEST_CREATED: "단건 결제 요청 생성",
  ADMIN_PAYMENT_REQUEST_SENT: "단건 결제 문자 발송",
  ADMIN_PAYMENT_REQUEST_CANCELED: "단건 결제 요청 취소",

  PAYMENT_CONFIRMED: "결제 확인",
  PAYMENT_AMOUNT_MISMATCH: "결제 금액 불일치",
  PAYMENT_DUPLICATE_REFUNDED: "중복 결제 자동 환불",
  PAYMENT_CANCELED_SYNC: "결제 취소 반영",
  WEBHOOK_SIGNATURE_INVALID: "웹훅 서명 검증 실패",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export interface AuditActor {
  id: string;
  username: string;
}

export interface AuditInput {
  actor?: AuditActor | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** 비밀번호·인증번호 등 비밀값은 절대 넣지 않는다 */
  detail?: Record<string, unknown>;
  /** 생략하면 현재 요청 헤더에서 읽는다 */
  ip?: string | null;
  userAgent?: string | null;
}

/** 열람 기록은 콘솔에 남기지 않는다 (DB에만 보관) */
const QUIET_PREFIX = "ADMIN_VIEW_";

export async function writeAudit(input: AuditInput): Promise<void> {
  let ip = input.ip;
  let userAgent = input.userAgent;
  if (ip === undefined || userAgent === undefined) {
    try {
      const headerStore = await headers();
      if (ip === undefined) ip = getClientIp(headerStore);
      if (userAgent === undefined) userAgent = headerStore.get("user-agent");
    } catch {
      // 요청 컨텍스트 밖(웹훅 후처리·정기 작업 등)
    }
  }

  const record = {
    actorId: input.actor?.id ?? null,
    actorUsername: input.actor?.username ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
    ip: ip && ip !== "unknown" ? ip.slice(0, 64) : null,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };

  if (!input.action.startsWith(QUIET_PREFIX)) {
    console.info(
      `[audit] ${record.action} actor=${record.actorUsername ?? "-"} target=${record.targetType ?? "-"}:${record.targetId ?? "-"} ip=${record.ip ?? "-"}`
    );
  }

  try {
    await prisma.auditLog.create({ data: record });
  } catch (e) {
    console.error("[audit] 기록 실패", input.action, e);
  }
}

/** 관리자 화면 열람 기록 (검색어·필터 포함) */
export async function logAdminView(
  session: { user: AuditActor },
  action: Extract<AuditAction, `ADMIN_VIEW_${string}`>,
  detail?: Record<string, unknown>
): Promise<void> {
  const cleaned = detail
    ? Object.fromEntries(Object.entries(detail).filter(([, v]) => v !== undefined && v !== ""))
    : undefined;
  await writeAudit({
    actor: { id: session.user.id, username: session.user.username },
    action,
    detail: cleaned && Object.keys(cleaned).length > 0 ? cleaned : undefined,
  });
}
