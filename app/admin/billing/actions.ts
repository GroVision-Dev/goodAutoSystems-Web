"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BILLING_MONTH_RE } from "@/lib/billing";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return session;
}

export interface BillingActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

function revalidateBilling() {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/mypage");
}

const monthlyFeeSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(0, "금액은 0 이상이어야 합니다."),
  title: z.string().trim().max(60, "항목명은 60자 이내로 입력하세요."),
});

/** 회원별 월 결제 설정 (금액 0이면 설정 해제) */
export async function setMonthlyFee(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const parsed = monthlyFeeSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount") || 0,
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  const { userId, amount, title } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "회원을 찾을 수 없습니다." };
  if (user.status === "WITHDRAWN") return { error: "탈퇴한 회원입니다." };
  if (amount > 0 && amount < 100) return { error: "금액은 100원 이상이어야 합니다." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      monthlyAmount: amount > 0 ? amount : null,
      monthlyTitle: amount > 0 ? title || "월 이용료" : null,
    },
  });
  revalidateBilling();
  return { ok: true, message: amount > 0 ? "월 결제 설정을 저장했습니다." : "월 결제 설정을 해제했습니다." };
}

const invoiceSchema = z.object({
  userId: z.string().min(1, "회원을 선택하세요."),
  billingMonth: z.string().regex(BILLING_MONTH_RE, "청구 월 형식이 올바르지 않습니다."),
  title: z.string().trim().min(1, "항목명을 입력하세요.").max(60),
  amount: z.coerce.number().int().min(100, "금액은 100원 이상이어야 합니다."),
  memo: z.string().trim().max(200).optional(),
});

/** 개별 청구서 발행 */
export async function createInvoice(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const parsed = invoiceSchema.safeParse({
    userId: formData.get("userId"),
    billingMonth: formData.get("billingMonth"),
    title: formData.get("title"),
    amount: formData.get("amount"),
    memo: (formData.get("memo") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  const { userId, billingMonth, title, amount, memo } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "WITHDRAWN") return { error: "유효한 회원이 아닙니다." };

  const existing = await prisma.invoice.findUnique({
    where: { userId_billingMonth: { userId, billingMonth } },
  });
  if (existing) {
    return { error: `${user.name} 회원에게 ${billingMonth} 청구서가 이미 있습니다.` };
  }

  await prisma.invoice.create({
    data: { userId, billingMonth, title, amount, memo: memo || null },
  });
  revalidateBilling();
  return { ok: true, message: `${user.name} · ${billingMonth} 청구서를 발행했습니다.` };
}

/** 월 결제 설정된 활성 회원 전원에게 해당 월 청구서 일괄 생성 (이미 있으면 건너뜀) */
export async function generateMonthlyInvoices(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const billingMonth = String(formData.get("billingMonth") ?? "");
  if (!BILLING_MONTH_RE.test(billingMonth)) {
    return { error: "청구 월 형식이 올바르지 않습니다." };
  }

  const targets = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      monthlyAmount: { gt: 0 },
      invoices: { none: { billingMonth } },
    },
  });
  if (targets.length === 0) {
    return { ok: true, message: `${billingMonth} 청구 대상이 없습니다. (이미 발행되었거나 설정된 회원이 없음)` };
  }

  await prisma.invoice.createMany({
    data: targets.map((user) => ({
      userId: user.id,
      billingMonth,
      title: user.monthlyTitle ?? "월 이용료",
      amount: user.monthlyAmount!,
    })),
  });
  revalidateBilling();
  return { ok: true, message: `${billingMonth} 청구서 ${targets.length}건을 생성했습니다.` };
}

/** 미납 청구서 취소 */
export async function cancelInvoice(invoiceId: string) {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("청구서를 찾을 수 없습니다.");
  if (invoice.status !== "UNPAID") throw new Error("미납 상태의 청구서만 취소할 수 있습니다.");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "CANCELED" },
  });
  revalidateBilling();
}

/** 취소된 청구서를 다시 미납으로 복구 */
export async function reopenInvoice(invoiceId: string) {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("청구서를 찾을 수 없습니다.");
  if (invoice.status !== "CANCELED") throw new Error("취소된 청구서만 복구할 수 있습니다.");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "UNPAID" },
  });
  revalidateBilling();
}
