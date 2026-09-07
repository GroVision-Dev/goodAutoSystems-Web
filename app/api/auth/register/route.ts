import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { MAX_VERIFY_ATTEMPTS } from "@/lib/verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { username, name, phone, password, code } = parsed.data;

  const usernameTaken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (usernameTaken) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const phoneTaken = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (phoneTaken) {
    return NextResponse.json({ error: "이미 가입된 휴대폰 번호입니다." }, { status: 409 });
  }

  // 휴대폰 인증번호 검증
  const verification = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (!verification) {
    return NextResponse.json(
      { error: "휴대폰 인증을 먼저 진행해 주세요." },
      { status: 400 }
    );
  }
  if (verification.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "인증번호가 만료되었습니다. 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json(
      { error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.code !== code) {
    await prisma.phoneVerification.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.$transaction([
      prisma.user.create({ data: { username, phone, passwordHash, name } }),
      prisma.phoneVerification.delete({ where: { phone } }),
    ]);
  } catch (e) {
    // 중복확인과 가입 사이에 같은 아이디/번호가 먼저 가입된 경우
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디 또는 휴대폰 번호입니다." },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
