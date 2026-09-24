/**
 * 포트원 V2 결제 실패 응답(code / message / pgCode / pgMessage)을
 * DB 저장용 failReason과 화면 표시용 값으로 정리한다.
 *
 * - PC 결제창: requestPayment 응답 객체에 담겨 온다.
 * - 리디렉션(모바일): redirectUrl 쿼리스트링으로 붙어 온다.
 * PG_PROVIDER_ERROR처럼 PG사(이니시스) 거절인 경우 실제 사유는 pgCode/pgMessage에 있다.
 */

export interface PaymentFailureInput {
  code?: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
}

export interface PaymentFailure {
  /** 표시용으로 정리한 포트원 오류 코드 */
  code: string;
  /** 표시용으로 정리한 PG 오류 코드 (없으면 빈 문자열) */
  pgCode: string;
  /** 표시용으로 정리한 PG 오류 메시지 (없으면 빈 문자열) */
  pgMessage: string;
  /** Order.failReason 저장값 (200자 이내) */
  failReason: string;
}

export const FAIL_REASON_MAX = 200;
const MESSAGE_MAX = 200;

/** 오류 코드는 영문·숫자·밑줄·하이픈만 남기고 40자로 자른다 (URL로 들어온 값을 그대로 띄우지 않기 위해) */
export function safeErrorCode(code: string | undefined): string {
  return (code ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
}

/** 메시지는 제어문자를 제거하고 공백을 정리한 뒤 길이를 제한한다 */
function safeMessage(text: string | undefined, max: number): string {
  return (text ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function formatPaymentFailure(input: PaymentFailureInput): PaymentFailure {
  const code = safeErrorCode(input.code);
  const pgCode = safeErrorCode(input.pgCode);
  const pgMessage = safeMessage(input.pgMessage, MESSAGE_MAX);
  const message = safeMessage(input.message, MESSAGE_MAX);

  let failReason: string;
  if (message) {
    failReason = `[${code}] ${message}`;
  } else {
    failReason = `결제 실패 (${code})`;
  }
  if (pgCode || pgMessage) {
    const pg = [pgCode, pgMessage].filter(Boolean).join(": ");
    failReason += ` | PG ${pg}`;
  }

  return { code, pgCode, pgMessage, failReason: failReason.slice(0, FAIL_REASON_MAX) };
}
