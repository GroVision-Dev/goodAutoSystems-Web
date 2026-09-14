import { checkRateLimit } from "@/lib/rate-limit";
import { getSmsConfig, sendSms } from "@/lib/sms";
import { SITE_INFO } from "@/lib/site-config";

/** 같은 종류 알림은 10분에 1건만 문자로 보낸다 (문자 비용·알림 폭주 방지) */
const ALERT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 보안 이벤트 알림: 관리자 로그인, 관리자 계정 잠금, 결제 금액 불일치, 웹훅 서명 실패 등.
 * 항상 서버 로그에 [security-alert]로 남기고, SOLAPI가 설정되어 있으면 관리자에게 문자도 보낸다.
 * 수신 번호: SECURITY_ALERT_PHONE (없으면 사이트 대표번호)
 */
export async function alertAdmin(key: string, text: string): Promise<void> {
  console.warn(`[security-alert] ${text}`);

  if (!checkRateLimit(`alert:${key}`, 1, ALERT_INTERVAL_MS).ok) return;
  const config = getSmsConfig();
  const phone = (process.env.SECURITY_ALERT_PHONE || SITE_INFO.phone).replace(/\D/g, "");
  if (!config || !phone) return;

  try {
    await sendSms(phone, `[Optix 보안] ${text}`.slice(0, 200), config);
  } catch (e) {
    console.error("[security-alert] 알림 문자 발송 실패", e);
  }
}
