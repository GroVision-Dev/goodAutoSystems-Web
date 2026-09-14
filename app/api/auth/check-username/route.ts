import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validators";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ username: usernameSchema });

/** 아이디 대량 조회(계정 수집) 방지: IP당 10분 30회 */
const CHECK_IP_LIMIT = 30;
const CHECK_IP_WINDOW_MS = 10 * 60 * 1000;

/** 회원가입 아이디 중복확인. 존재 여부 외 다른 정보는 내보내지 않는다. */
export async function POST(request: Request) {
  const limit = checkRateLimit(
    `check-username:${getClientIp(request)}`,
    CHECK_IP_LIMIT,
    CHECK_IP_WINDOW_MS
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

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
