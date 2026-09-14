import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSmsConfig, sendSms } from "@/lib/sms";

/**
 * 관리자 로그인 2단계 인증 (문자 인증번호).
 * 코드는 평문 대신 AUTH_SECRET 기반 HMAC으로 저장하고, 5분 유효·5회 입력 제한·60초 재발송 간격을 둔다.
 */

export const ADMIN_OTP_TTL_MS = 5 * 60 * 1000;
export const ADMIN_OTP_RESEND_MS = 60 * 1000;
export const ADMIN_OTP_MAX_ATTEMPTS = 5;

function hashOtp(userId: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET가 설정되지 않았습니다.");
  return createHmac("sha256", secret).update(`admin-otp:${userId}:${code}`).digest("hex");
}

export function adminOtpSmsText(code: string) {
  return `[Optix] 관리자 로그인 인증번호 ${code} (5분 유효)`;
}

/** 인증번호 발송. 재발송 간격 안이면 보내지 않고 기존 코드를 쓰게 한다 */
export async function sendAdminOtp(user: {
  id: string;
  phone: string;
}): Promise<{ sent: boolean }> {
  const existing = await prisma.loginOtp.findUnique({ where: { userId: user.id } });
  if (
    existing &&
    existing.expiresAt > new Date() &&
    Date.now() - existing.createdAt.getTime() < ADMIN_OTP_RESEND_MS
  ) {
    return { sent: false };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = {
    codeHash: hashOtp(user.id, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + ADMIN_OTP_TTL_MS),
    createdAt: new Date(),
  };
  await prisma.loginOtp.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  const config = getSmsConfig();
  if (!config) {
    console.warn(
      `[admin-otp] SOLAPI 미설정 — 문자 대신 서버 로그로 출력합니다. 운영에서는 반드시 SOLAPI를 설정하세요. ${user.phone} 인증번호: ${code}`
    );
    return { sent: true };
  }
  await sendSms(user.phone, adminOtpSmsText(code), config);
  return { sent: true };
}

export type OtpResult = "ok" | "invalid" | "expired";

export async function verifyAdminOtp(userId: string, code: string): Promise<OtpResult> {
  const row = await prisma.loginOtp.findUnique({ where: { userId } });
  if (!row) return "expired";
  if (row.expiresAt <= new Date() || row.attempts >= ADMIN_OTP_MAX_ATTEMPTS) {
    await prisma.loginOtp.delete({ where: { userId } }).catch(() => null);
    return "expired";
  }

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashOtp(userId, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prisma.loginOtp.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  await prisma.loginOtp.delete({ where: { userId } }).catch(() => null);
  return "ok";
}
