import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { MAX_VERIFY_ATTEMPTS } from "@/lib/verification";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/login-security";
import { writeAudit } from "@/lib/audit";

/** 대량 가입 방지: IP당 1시간 10회 */
const REGISTER_IP_LIMIT = 10;
const REGISTER_IP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const limit = checkRateLimit(
    `register:${getClientIp(request)}`,
    REGISTER_IP_LIMIT,
    REGISTER_IP_WINDOW_MS
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { username, name, email, phone, password, code } = parsed.data;

  // 1) 휴대폰 인증번호부터 검증한다 — 번호 소유를 확인하기 전에는 이메일·번호 가입 여부를 알려주지 않는다
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

  // 2) 중복 확인 (아이디는 중복확인 화면에서 이미 공개되는 정보)
  const [usernameTaken, emailTaken, phoneTaken] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  if (usernameTaken) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }
  if (phoneTaken) {
    return NextResponse.json(
      { error: "이미 가입된 휴대폰 번호입니다. 로그인하거나 고객센터로 문의해 주세요." },
      { status: 409 }
    );
  }
  if (emailTaken) {
    return NextResponse.json(
      { error: "사용할 수 없는 이메일입니다. 다른 이메일을 입력해 주세요." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const agreedAt = new Date();
  try {
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          username,
          email,
          phone,
          passwordHash,
          name,
          termsAgreedAt: agreedAt,
          privacyAgreedAt: agreedAt,
        },
      }),
      prisma.phoneVerification.delete({ where: { phone } }),
    ]);
    await writeAudit({
      actor: { id: user.id, username: user.username },
      action: "USER_REGISTERED",
    });
  } catch (e) {
    // 중복확인과 가입 사이에 같은 아이디/이메일/번호가 먼저 가입된 경우
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디, 이메일 또는 휴대폰 번호입니다." },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
