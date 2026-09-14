import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clearRateLimit, checkRateLimit, isRateLimited, recordHit } from "@/lib/rate-limit";
import { passwordPolicyError } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { alertAdmin } from "@/lib/alert";

/**
 * 아이디·비밀번호 검증 (웹 로그인·프로그램 로그인 공용)
 * - 무차별 대입 방어: IP당 시도 제한 + 아이디당 연속 실패 5회 시 15분 잠금
 * - 계정 열거 방지: 없는 아이디도 같은 bcrypt 비교를 수행하고, 잠금도 존재 여부와 무관하게 동일하게 동작
 */

export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;
const IP_WINDOW_MS = 10 * 60 * 1000;

let dummyHash: Promise<string> | null = null;
/** 없는 계정에도 같은 시간을 쓰기 위한 비교용 해시 */
function getDummyHash() {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_COST);
  return dummyHash;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** 해시를 비교하되, 비어 있는 해시(탈퇴 회원)는 더미와 비교해 시간을 맞추고 false */
export async function comparePassword(password: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(password, await getDummyHash());
    return false;
  }
  return bcrypt.compare(password, hash);
}

export type CredentialCheck =
  | { ok: true; user: User; weakPassword: boolean }
  | { ok: false; reason: "invalid" | "rate_limited" }
  /** 비밀번호는 맞지만 정지된 계정 (비밀번호를 아는 경우에만 알려준다) */
  | { ok: false; reason: "inactive" };

export async function checkCredentials(params: {
  username: string;
  password: string;
  ip: string;
  userAgent: string | null;
  channel: "web" | "program";
}): Promise<CredentialCheck> {
  const { username, password, ip, userAgent, channel } = params;
  const failedAction = channel === "web" ? "LOGIN_FAILED" : "PROGRAM_LOGIN_FAILED";
  const failKey = `login-fail:${username}`;

  if (!checkRateLimit(`login-ip:${ip}`, IP_LIMIT, IP_WINDOW_MS).ok) {
    await writeAudit({ action: "LOGIN_BLOCKED", detail: { username, channel, by: "ip" }, ip, userAgent });
    return { ok: false, reason: "rate_limited" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const now = new Date();

  const memoryLocked = isRateLimited(failKey, MAX_FAILED_LOGINS, LOGIN_LOCK_MS).limited;
  const dbLocked = Boolean(user?.lockedUntil && user.lockedUntil > now);
  if (memoryLocked || dbLocked) {
    await comparePassword(password, null);
    await writeAudit({ action: "LOGIN_BLOCKED", detail: { username, channel, by: "account" }, ip, userAgent });
    return { ok: false, reason: "rate_limited" };
  }

  const valid = await comparePassword(password, user?.passwordHash);

  if (!user || !valid) {
    recordHit(failKey);
    if (user && user.status !== "WITHDRAWN") {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now.getTime() + LOGIN_LOCK_MS) : undefined,
        },
      });
      if (lock && user.role === "ADMIN") {
        await alertAdmin(
          `admin-lock:${user.id}`,
          `관리자 계정 ${user.username} 로그인 ${MAX_FAILED_LOGINS}회 실패로 15분 잠금 (IP ${ip})`
        );
      }
    }
    await writeAudit({ action: failedAction, detail: { username, channel }, ip, userAgent });
    return { ok: false, reason: "invalid" };
  }

  if (user.status !== "ACTIVE") {
    await writeAudit({
      actor: { id: user.id, username: user.username },
      action: failedAction,
      detail: { username, channel, status: user.status },
      ip,
      userAgent,
    });
    return { ok: false, reason: user.status === "SUSPENDED" ? "inactive" : "invalid" };
  }

  clearRateLimit(failKey);
  const rehash = bcrypt.getRounds(user.passwordHash) < BCRYPT_COST;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      ...(rehash ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  return {
    ok: true,
    user: updated,
    weakPassword: passwordPolicyError(password, user.username) !== null,
  };
}
