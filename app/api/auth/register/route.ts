import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { password, name, code } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다." },
      { status: 409 }
    );
  }

  // 이메일 인증코드 검증
  const verification = await prisma.emailVerification.findUnique({
    where: { email },
  });
  if (!verification) {
    return NextResponse.json(
      { error: "이메일 인증을 먼저 진행해 주세요." },
      { status: 400 }
    );
  }
  if (verification.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "인증코드가 만료되었습니다. 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "인증 시도 횟수를 초과했습니다. 코드를 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.code !== code) {
    await prisma.emailVerification.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json(
      { error: "인증코드가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.create({ data: { email, passwordHash, name } }),
    prisma.emailVerification.delete({ where: { email } }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
