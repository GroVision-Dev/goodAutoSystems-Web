import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash, name } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
