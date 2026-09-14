import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators";
import { signProgramToken } from "@/lib/program-jwt";
import { getClientIp } from "@/lib/rate-limit";
import { checkCredentials } from "@/lib/login-security";
import { writeAudit } from "@/lib/audit";

/** 데스크톱 프로그램 로그인: 웹사이트 계정(아이디/비밀번호)으로 인증 후 JWT 발급 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const result = await checkCredentials({
    username: parsed.data.username,
    password: parsed.data.password,
    ip,
    userAgent,
    channel: "program",
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return NextResponse.json(
        { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }
    if (result.reason === "inactive") {
      return NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const { user } = result;
  const { token, expiresIn } = await signProgramToken({
    sub: user.id,
    username: user.username,
    ver: user.tokenVersion,
  });
  await writeAudit({
    actor: { id: user.id, username: user.username },
    action: "PROGRAM_LOGIN_SUCCESS",
    ip,
    userAgent,
  });

  return NextResponse.json({
    accessToken: token,
    expiresIn,
    user: { id: user.id, username: user.username, name: user.name },
  });
}
