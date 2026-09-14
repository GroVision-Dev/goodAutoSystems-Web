import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { getClientIp } from "@/lib/rate-limit";
import { checkCredentials } from "@/lib/login-security";
import { sendAdminOtp, verifyAdminOtp } from "@/lib/admin-otp";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  createUserSession,
  revokeSession,
} from "@/lib/user-session";
import { writeAudit } from "@/lib/audit";
import { alertAdmin } from "@/lib/alert";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      role: "USER" | "ADMIN";
      /** 서버 세션(UserSession) id */
      sessionId: string;
      /** 관리자 문자 2단계 인증을 거친 세션 */
      mfa: boolean;
      /** 로그인 비밀번호가 현재 정책 미달 */
      weakPassword: boolean;
    };
  }
}

/** 로그인 폼에 전달되는 오류 코드 (URL에 노출되므로 계정 존재 여부를 암시하지 않는다) */
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}
class OtpRequiredError extends CredentialsSignin {
  code = "otp_required";
}
class OtpInvalidError extends CredentialsSignin {
  code = "otp_invalid";
}
class OtpExpiredError extends CredentialsSignin {
  code = "otp_expired";
}
class OtpSendFailedError extends CredentialsSignin {
  code = "otp_send_failed";
}

interface AuthorizedUser {
  id: string;
  username: string;
  name: string;
  role: "USER" | "ADMIN";
  sessionId: string;
  mfa: boolean;
  weakPassword: boolean;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_COOKIE_MAX_AGE_SECONDS, updateAge: 60 * 60 },
  pages: { signIn: "/login" },
  logger: {
    error(error) {
      // 잘못된 비밀번호 등 예상된 로그인 실패는 감사 로그로 남기므로 스택을 찍지 않는다
      if ((error as { type?: string }).type === "CredentialsSignin") return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { username: {}, password: {}, otp: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { username, password, otp } = parsed.data;

        const ip = getClientIp(request);
        const userAgent = request.headers.get("user-agent");
        const result = await checkCredentials({ username, password, ip, userAgent, channel: "web" });
        if (!result.ok) {
          if (result.reason === "rate_limited") throw new RateLimitedError();
          return null;
        }

        const { user, weakPassword } = result;
        const actor = { id: user.id, username: user.username };
        let mfa = false;

        if (user.role === "ADMIN") {
          if (!otp) {
            let sent: boolean;
            try {
              ({ sent } = await sendAdminOtp(user));
            } catch (e) {
              console.error("[auth] 관리자 인증번호 문자 발송 실패 — 관리자 휴대폰 번호(SEED_ADMIN_PHONE)와 SOLAPI 설정 확인", e);
              throw new OtpSendFailedError();
            }
            if (sent) await writeAudit({ actor, action: "ADMIN_OTP_SENT", ip, userAgent });
            throw new OtpRequiredError();
          }
          const verified = await verifyAdminOtp(user.id, otp);
          if (verified !== "ok") {
            await writeAudit({ actor, action: "ADMIN_OTP_FAILED", detail: { result: verified }, ip, userAgent });
            throw verified === "invalid" ? new OtpInvalidError() : new OtpExpiredError();
          }
          mfa = true;
        }

        const session = await createUserSession({
          userId: user.id,
          role: user.role,
          mfa,
          weakPassword,
          ip,
          userAgent,
        });
        await writeAudit({
          actor,
          action: "LOGIN_SUCCESS",
          detail: { role: user.role, ...(weakPassword ? { weakPassword: true } : {}) },
          ip,
          userAgent,
        });
        if (user.role === "ADMIN") {
          await alertAdmin(`admin-login:${user.id}`, `관리자 ${user.username} 로그인 (IP ${ip})`);
        }

        const authorized: AuthorizedUser = {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          sessionId: session.id,
          mfa,
          weakPassword,
        };
        return authorized;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthorizedUser;
        token.id = u.id;
        token.sid = u.sessionId;
        token.username = u.username;
        token.name = u.name;
        token.role = u.role;
        token.mfa = u.mfa;
        token.weakPassword = u.weakPassword;
        return token;
      }

      // 매 요청마다 서버 세션을 확인해 로그아웃·비밀번호 변경·정지·권한 변경을 즉시 반영한다
      if (typeof token.sid !== "string") return null;
      const session = await prisma.userSession.findUnique({
        where: { id: token.sid },
        include: { user: { select: { id: true, username: true, name: true, role: true, status: true } } },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.id !== token.id ||
        session.user.status !== "ACTIVE"
      ) {
        return null;
      }
      token.username = session.user.username;
      token.name = session.user.name;
      token.role = session.user.role;
      token.mfa = session.mfa;
      token.weakPassword = session.weakPassword;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = token.username as string;
      session.user.name = token.name as string;
      session.user.role = token.role as "USER" | "ADMIN";
      session.user.sessionId = token.sid as string;
      session.user.mfa = Boolean(token.mfa);
      session.user.weakPassword = Boolean(token.weakPassword);
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (!token || typeof token.sid !== "string") return;
      await revokeSession(token.sid);
      if (typeof token.id === "string" && typeof token.username === "string") {
        await writeAudit({ actor: { id: token.id, username: token.username }, action: "LOGOUT" });
      }
    },
  },
});
