import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { signProgramToken } from "@/lib/program-jwt";

/** 데스크톱 프로그램 로그인: 웹사이트 계정으로 인증 후 JWT 발급 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "이메일과 비밀번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (user.status === "SUSPENDED") {
    return NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const { token, expiresIn } = await signProgramToken({
    sub: user.id,
    email: user.email,
  });

  return NextResponse.json({
    accessToken: token,
    expiresIn,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
