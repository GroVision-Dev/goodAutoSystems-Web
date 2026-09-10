import { createHmac, randomBytes } from "node:crypto";
import { VERIFICATION_TTL_MINUTES } from "@/lib/verification";

/**
 * SOLAPI(쿨SMS) 단건 문자 발송.
 * ito_lineage_macro_web의 api/app/services/sms_sender.py를 포팅했다.
 * SDK 없이 REST API + HMAC-SHA256 인증 헤더를 직접 만든다.
 * SOLAPI_* 환경변수가 없으면(로컬 개발) 발송 대신 서버 콘솔에 코드를 출력한다.
 */

const SOLAPI_SEND_URL = "https://api.solapi.com/messages/v4/send";
const REQUEST_TIMEOUT_MS = 5000;

export interface SmsConfig {
  apiKey: string;
  apiSecret: string;
  /** 발신번호 — 숫자만. SOLAPI 콘솔에 사전 등록된 번호여야 한다 */
  sender: string;
}

export function getSmsConfig(): SmsConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = (process.env.SOLAPI_SENDER ?? "").replace(/\D/g, "");
  if (!apiKey || !apiSecret || !sender) return null;
  return { apiKey, apiSecret, sender };
}

export function isSmsDevMode() {
  return getSmsConfig() === null;
}

/** SOLAPI HMAC-SHA256 인증 헤더. signature = HMAC(secret, date + salt) hex */
export function buildSolapiAuthHeader(
  apiKey: string,
  apiSecret: string,
  date: string = new Date().toISOString(),
  salt: string = randomBytes(16).toString("hex")
) {
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export class SmsSendError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`SOLAPI 발송 실패 (HTTP ${status}): ${body}`);
    this.name = "SmsSendError";
  }
}

export async function sendSms(
  to: string,
  text: string,
  config: SmsConfig | null = getSmsConfig()
) {
  if (!config) {
    throw new Error(
      "SOLAPI 설정이 없습니다. (SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER)"
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(SOLAPI_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: buildSolapiAuthHeader(config.apiKey, config.apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { to, from: config.sender, text } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new SmsSendError(res.status, await res.text().catch(() => ""));
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 단문(SMS, 90바이트) 범위 안에서 유지한다 */
export function verificationSmsText(code: string) {
  return `[Optix] 회원가입 인증번호 ${code} (${VERIFICATION_TTL_MINUTES}분 유효)`;
}

/**
 * 청구서 안내 문자. SOLAPI 미설정(로컬)이면 콘솔에 출력하고 false를 반환한다.
 * 반환값이 true일 때만 실제로 발송된 것이다.
 */
export async function sendInvoiceSms(phone: string, text: string): Promise<boolean> {
  const config = getSmsConfig();
  if (!config) {
    console.log(`[sms] SOLAPI 미설정 — 개발 모드. ${phone} 청구서 안내: ${text}`);
    return false;
  }
  await sendSms(phone, text, config);
  return true;
}

export async function sendVerificationSms(phone: string, code: string) {
  const config = getSmsConfig();
  if (!config) {
    console.log(
      `[sms] SOLAPI 미설정 — 개발 모드. ${phone} 인증번호: ${code} (${VERIFICATION_TTL_MINUTES}분 유효)`
    );
    return;
  }
  await sendSms(phone, verificationSmsText(code), config);
}
