"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AccountFormState {
  error?: string;
  ok?: string;
}

async function requireUser() {
  const session = await auth();
  if (!session) throw new Error("로그인이 필요합니다.");
  return session;
}

const profileSchema = z.object({
  name: z.string().min(2, "이름은 2자 이상이어야 합니다."),
});

export async function updateProfile(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });
  revalidatePath("/mypage");
  return { ok: "이름이 변경되었습니다. 다음 로그인부터 화면에 반영됩니다." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요."),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
  newPasswordConfirm: z.string(),
});

export async function changePassword(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordConfirm: formData.get("newPasswordConfirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }
  if (parsed.data.newPassword !== parsed.data.newPasswordConfirm) {
    return { error: "새 비밀번호가 서로 일치하지 않습니다." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "계정을 찾을 수 없습니다." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "현재 비밀번호가 올바르지 않습니다." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  return { ok: "비밀번호가 변경되었습니다. 프로그램 로그인에도 새 비밀번호를 사용하세요." };
}

const withdrawSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력하세요."),
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

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "계정을 찾을 수 없습니다." };
  if (user.role === "ADMIN") {
    return { error: "관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 권한을 위임한 뒤 진행하세요." };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return { error: "비밀번호가 올바르지 않습니다." };

  // 주문·결제 기록은 전자상거래법에 따라 보관해야 하므로 계정을 삭제하지 않고
  // 개인정보를 익명화한 뒤 WITHDRAWN 처리한다.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "WITHDRAWN",
      email: `withdrawn-${user.id}@removed.invalid`,
      name: "탈퇴회원",
      passwordHash: "",
    },
  });

  await signOut({ redirectTo: "/?withdrawn=1" });
  return { ok: "탈퇴 처리되었습니다." };
}
