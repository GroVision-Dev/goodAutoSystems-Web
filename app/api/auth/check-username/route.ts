import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validators";

const schema = z.object({ username: usernameSchema });

/** 회원가입 아이디 중복확인. 존재 여부 외 다른 정보는 내보내지 않는다. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const exists = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });

  return NextResponse.json({ available: !exists });
}
