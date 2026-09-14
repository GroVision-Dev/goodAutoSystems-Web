import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendRegisteredPhoneNotice, sendVerificationSms, isSmsDevMode } from "@/lib/sms";
import { phoneSchema } from "@/lib/validators";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  RESEND_INTERVAL_MS,
  RESEND_INTERVAL_SECONDS,
  VERIFICATION_TTL_MS,
  VERIFICATION_TTL_MINUTES,
} from "@/lib/verification";

const schema = z.object({ phone: phoneSchema });

/** 문자는 건당 과금이므로 IP당 1시간 10건, 번호당 하루 5건으로 제한한다 */
const SMS_IP_LIMIT = 10;
const SMS_IP_WINDOW_MS = 60 * 60 * 1000;
const SMS_PHONE_DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const LIMIT_MESSAGE = "인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";

function sentResponse() {
  return NextResponse.json({
    ok: true,
    ttlMinutes: VERIFICATION_TTL_MINUTES,
    resendSeconds: RESEND_INTERVAL_SECONDS,
    // SOLAPI 미설정 시 클라이언트에 알려 개발 모드 안내를 띄운다
    devMode: isSmsDevMode(),
  });
}

function resendTooSoon() {
  return NextResponse.json(
    { error: `잠시 후 다시 요청해 주세요. (재발송은 ${RESEND_INTERVAL_SECONDS}초 간격)` },
    { status: 429 }
  );
}

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

  const ipLimit = checkRateLimit(`sms:${getClientIp(request)}`, SMS_IP_LIMIT, SMS_IP_WINDOW_MS);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }
  // 같은 번호로 반복 발송(문자 폭탄) 방지 — 가입 여부와 무관하게 동일하게 적용
  const phoneLimit = checkRateLimit(`sms-phone:${phone}`, SMS_PHONE_DAILY_LIMIT, DAY_MS);
  if (!phoneLimit.ok) {
    return NextResponse.json(
      { error: LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(phoneLimit.retryAfterSeconds) } }
    );
  }

  // 계정 열거 방지: 이미 가입된 번호도 화면 응답은 동일하게 하고, 번호 주인에게 안내 문자만 보낸다
  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) {
    if (!checkRateLimit(`sms-registered:${phone}`, 1, RESEND_INTERVAL_MS).ok) {
      return resendTooSoon();
    }
    try {
      await sendRegisteredPhoneNotice(phone);
    } catch (e) {
      console.error("[send-verification] 가입 번호 안내 문자 실패:", e);
    }
    return sentResponse();
  }

  const existing = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_INTERVAL_MS) {
    return resendTooSoon();
  }

  const code = String(randomInt(100000, 1000000));

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

  return sentResponse();
}
