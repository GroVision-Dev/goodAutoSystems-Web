/** 저장 형식: 숫자만, 010으로 시작하는 11자리 */
export const PHONE_PATTERN = /^010\d{8}$/;

/**
 * 입력값에서 숫자만 남기고 형식을 검사한다.
 * "010-1234-5678" → "01012345678", 형식이 맞지 않으면 null.
 */
export function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  return PHONE_PATTERN.test(digits) ? digits : null;
}

/** "01012345678" → "010-1234-5678". 저장 형식이 아니면 입력 그대로 반환. */
export function formatPhone(phone: string): string {
  if (!PHONE_PATTERN.test(phone)) return phone;
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
}
