import { SignJWT, jwtVerify } from "jose";

const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7일

function getSecret() {
  const secret = process.env.PROGRAM_JWT_SECRET;
  if (!secret) throw new Error("PROGRAM_JWT_SECRET가 설정되지 않았습니다.");
  return new TextEncoder().encode(secret);
}

export interface ProgramTokenPayload {
  sub: string; // user id
  username: string;
  /** User.tokenVersion — 비밀번호 변경·정지·탈퇴 시 올라가 기존 토큰을 무효화한다 */
  ver: number;
}

export async function signProgramToken(payload: ProgramTokenPayload) {
  const token = await new SignJWT({ username: payload.username, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN_SECONDS}s`)
    .sign(getSecret());
  return { token, expiresIn: EXPIRES_IN_SECONDS };
}

export async function verifyProgramToken(
  token: string
): Promise<ProgramTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.username !== "string") return null;
    // ver 도입 전에 발급된 토큰은 0으로 본다
    const ver = typeof payload.ver === "number" ? payload.ver : 0;
    return { sub: payload.sub, username: payload.username, ver };
  } catch {
    return null;
  }
}

/** Authorization: Bearer <token> 헤더에서 토큰 추출 */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}
