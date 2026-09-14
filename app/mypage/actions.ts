"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emailSchema, passwordPolicyError } from "@/lib/validators";
import { requireUser } from "@/lib/auth-guard";
import { comparePassword, hashPassword } from "@/lib/login-security";
import { revokeUserSessions } from "@/lib/user-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export interface AccountFormState {
  error?: string;
  ok?: string;
}

/** 세션 탈취 후 비밀번호 추측을 막기 위해 비밀번호 확인은 회원당 15분 5회까지 */
const PASSWORD_CONFIRM_LIMIT = 5;
const PASSWORD_CONFIRM_WINDOW_MS = 15 * 60 * 1000;
const TOO_MANY_ATTEMPTS = "비밀번호 확인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.";

function passwordConfirmAllowed(userId: string) {
  return checkRateLimit(`pw-confirm:${userId}`, PASSWORD_CONFIRM_LIMIT, PASSWORD_CONFIRM_WINDOW_MS).ok;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(40, "이름은 40자 이내로 입력해 주세요."),
  email: emailSchema,
});

export async function updateProfile(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name, email: parsed.data.email },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "다른 계정에서 이미 사용 중인 이메일입니다." };
    }
    throw e;
  }
  await writeAudit({
    actor: { id: session.user.id, username: session.user.username },
    action: "PROFILE_UPDATED",
    targetType: "user",
    targetId: session.user.id,
  });
  revalidatePath("/mypage");
  return { ok: "회원 정보가 저장되었습니다." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요.").max(200),
  newPassword: z.string().min(1, "새 비밀번호를 입력하세요."),
  newPasswordConfirm: z.string(),
});

export async function changePassword(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireUser();
  const actor = { id: session.user.id, username: session.user.username };
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordConfirm: formData.get("newPasswordConfirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }
  const { currentPassword, newPassword, newPasswordConfirm } = parsed.data;
  if (newPassword !== newPasswordConfirm) {
    return { error: "새 비밀번호가 서로 일치하지 않습니다." };
  }
  if (!passwordConfirmAllowed(session.user.id)) return { error: TOO_MANY_ATTEMPTS };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "계정을 찾을 수 없습니다." };

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    await writeAudit({ actor, action: "PASSWORD_CHANGE_FAILED", targetType: "user", targetId: user.id });
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }
  const policyError = passwordPolicyError(newPassword, user.username);
  if (policyError) return { error: policyError };
  if (newPassword === currentPassword) {
    return { error: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." };
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  // 비밀번호 변경 시: 다른 기기의 웹 세션 폐기 + 프로그램 토큰 무효화(tokenVersion) + 현재 세션의 정책 미달 표시 해제
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null, id: { not: session.user.sessionId } },
      data: { revokedAt: now },
    }),
    prisma.userSession.updateMany({
      where: { id: session.user.sessionId },
      data: { weakPassword: false },
    }),
  ]);
  await writeAudit({ actor, action: "PASSWORD_CHANGED", targetType: "user", targetId: user.id });
  revalidatePath("/mypage");
  return {
    ok: "비밀번호가 변경되었습니다. 다른 기기의 로그인과 프로그램 로그인은 모두 해제되었으니 새 비밀번호로 다시 로그인하세요.",
  };
}

const withdrawSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력하세요.").max(200),
});

export async function withdrawAccount(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireUser();
  const parsed = withdrawSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }
  if (!passwordConfirmAllowed(session.user.id)) return { error: TOO_MANY_ATTEMPTS };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "계정을 찾을 수 없습니다." };
  if (user.role === "ADMIN") {
    return { error: "관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 권한을 위임한 뒤 진행하세요." };
  }

  const valid = await comparePassword(parsed.data.password, user.passwordHash);
  if (!valid) return { error: "비밀번호가 올바르지 않습니다." };

  // 주문·결제 기록은 전자상거래법에 따라 보관해야 하므로 계정을 삭제하지 않고
  // 개인정보를 익명화한 뒤 WITHDRAWN 처리한다.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "WITHDRAWN",
      username: `withdrawn-${user.id}`,
      phone: `withdrawn-${user.id}`,
      email: null,
      name: "탈퇴회원",
      passwordHash: "",
      tokenVersion: { increment: 1 },
    },
  });
  await revokeUserSessions(user.id);
  await writeAudit({
    actor: { id: user.id, username: user.username },
    action: "ACCOUNT_WITHDRAWN",
    targetType: "user",
    targetId: user.id,
  });

  await signOut({ redirectTo: "/?withdrawn=1" });
  return { ok: "탈퇴 처리되었습니다." };
}
