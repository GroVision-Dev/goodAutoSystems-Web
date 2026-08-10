import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});

const CODE_TTL_MS = 10 * 60 * 1000; // 10분
const RESEND_INTERVAL_MS = 60 * 1000; // 재발송 최소 간격 60초

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다." },
      { status: 409 }
    );
  }

  const existing = await prisma.emailVerification.findUnique({
    where: { email },
  });
  if (
    existing &&
    Date.now() - existing.createdAt.getTime() < RESEND_INTERVAL_MS
  ) {
    return NextResponse.json(
      { error: "잠시 후 다시 요청해 주세요. (재발송은 1분 간격)" },
      { status: 429 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.emailVerification.upsert({
    where: { email },
    update: {
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      createdAt: new Date(),
    },
    create: {
      email,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  try {
    await sendVerificationEmail(email, code);
  } catch (e) {
    console.error("[send-verification] 메일 발송 실패:", e);
    return NextResponse.json(
      { error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
