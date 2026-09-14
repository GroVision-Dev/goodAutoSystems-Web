import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyProgramToken } from "@/lib/program-jwt";

/**
 * 데스크톱 프로그램 API 공통 인증.
 * 토큰 서명·만료 외에 계정 상태와 tokenVersion을 확인해,
 * 비밀번호 변경·정지·탈퇴 이후에는 기존 토큰을 즉시 거부한다.
 */
export async function authenticateProgramRequest(
  request: Request
): Promise<{ user: User } | { response: NextResponse }> {
  const token = extractBearerToken(request);
  const payload = token ? await verifyProgramToken(token) : null;
  if (!payload) {
    return { response: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === "WITHDRAWN" || user.tokenVersion !== payload.ver) {
    return {
      response: NextResponse.json(
        { error: "로그인 정보가 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 }
      ),
    };
  }
  if (user.status === "SUSPENDED") {
    return { response: NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 }) };
  }
  return { user };
}
