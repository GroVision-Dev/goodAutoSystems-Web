/** 회원가입 이메일 인증 정책 — 서버·메일·화면이 모두 이 값을 참조한다 */
export const VERIFICATION_TTL_MINUTES = 10;
export const VERIFICATION_TTL_MS = VERIFICATION_TTL_MINUTES * 60 * 1000;
/** 재발송 최소 간격(초) */
export const RESEND_INTERVAL_SECONDS = 60;
export const RESEND_INTERVAL_MS = RESEND_INTERVAL_SECONDS * 1000;
/** 코드 입력 최대 시도 횟수 */
export const MAX_VERIFY_ATTEMPTS = 5;
