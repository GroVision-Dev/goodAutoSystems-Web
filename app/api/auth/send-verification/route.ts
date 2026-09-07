import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationSms, isSmsDevMode } from "@/lib/sms";
import { phoneSchema } from "@/lib/validators";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  RESEND_INTERVAL_MS,
  RESEND_INTERVAL_SECONDS,
  VERIFICATION_TTL_MS,
  VERIFICATION_TTL_MINUTES,
} from "@/lib/verification";

const schema = z.object({ phone: phoneSchema });

/** 문자는 건당 과금이므로 IP당 1시간 10건으로 제한한다 */
const SMS_IP_LIMIT = 10;
const SMS_IP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const phone = parsed.data.phone;

  const ipLimit = checkRateLimit(
    `sms:${getClientIp(request)}`,
    SMS_IP_LIMIT,
    SMS_IP_WINDOW_MS
  );
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 휴대폰 번호입니다." },
      { status: 409 }
    );
  }

  const existing = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_INTERVAL_MS) {
    return NextResponse.json(
      { error: `잠시 후 다시 요청해 주세요. (재발송은 ${RESEND_INTERVAL_SECONDS}초 간격)` },
      { status: 429 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.phoneVerification.upsert({
    where: { phone },
    update: {
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      createdAt: new Date(),
    },
    create: {
      phone,
      code,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  try {
    await sendVerificationSms(phone, code);
  } catch (e) {
    console.error("[send-verification] 문자 발송 실패:", e);
    return NextResponse.json(
      { error: "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    ttlMinutes: VERIFICATION_TTL_MINUTES,
    resendSeconds: RESEND_INTERVAL_SECONDS,
    // SOLAPI 미설정 시 클라이언트에 알려 개발 모드 안내를 띄운다
    devMode: isSmsDevMode(),
  });
}
