import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyProgramToken } from "@/lib/program-jwt";

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  const payload = token ? await verifyProgramToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return NextResponse.json({ error: "존재하지 않는 계정입니다." }, { status: 401 });
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 });
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
