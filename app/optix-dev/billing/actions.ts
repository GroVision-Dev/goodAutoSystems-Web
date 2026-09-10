"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BILLING_MONTH_RE,
  computeDueDate,
  formatBillingMonth,
  invoiceSmsText,
} from "@/lib/billing";
import { sendInvoiceSms } from "@/lib/sms";

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
  revalidatePath("/optix-dev/billing");
  revalidatePath("/optix-dev/users");
  revalidatePath("/optix-dev");
  revalidatePath("/mypage");
}

/** 문자 본문에 넣을 사이트 주소 (AUTH_URL 기준) */
function siteUrl() {
  return (process.env.AUTH_URL ?? "https://optix.goodautosys.kr").replace(/\/$/, "");
}

const billingDaySchema = z.coerce
  .number()
  .int()
  .min(1, "결제일은 1~31 사이여야 합니다.")
  .max(31, "결제일은 1~31 사이여야 합니다.");

/** 폼의 결제일 값을 파싱. 비어 있으면 null */
function parseBillingDay(raw: FormDataEntryValue | null): number | null | { error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const parsed = billingDaySchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "결제일이 올바르지 않습니다." };
  return parsed.data;
}

/**
 * 청구서 안내 문자를 보내고 notifiedAt을 기록한다.
 * SOLAPI 미설정(로컬)이면 발송하지 않고 false를 돌려준다.
 */
async function notifyInvoice(invoice: {
  id: string;
  title: string;
  billingMonth: string;
  amount: number;
  dueDate: Date | null;
  user: { phone: string };
}): Promise<boolean> {
  const sent = await sendInvoiceSms(
    invoice.user.phone,
    invoiceSmsText({
      title: invoice.title,
      billingMonth: invoice.billingMonth,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      siteUrl: siteUrl(),
    })
  );
  if (sent) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { notifiedAt: new Date() },
    });
  }
  return sent;
}

const monthlyFeeSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(0, "금액은 0 이상이어야 합니다."),
  title: z.string().trim().max(60, "항목명은 60자 이내로 입력하세요."),
});

/** 회원별 월 결제 설정 (금액 0이면 설정 해제). 결제일은 매월 N일 */
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
  const billingDay = parseBillingDay(formData.get("billingDay"));
  if (billingDay !== null && typeof billingDay === "object") return billingDay;

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
      billingDay: amount > 0 ? billingDay : null,
    },
  });
  revalidateBilling();
  if (amount <= 0) return { ok: true, message: "월 결제 설정을 해제했습니다." };
  return {
    ok: true,
    message: billingDay
      ? `저장했습니다. 매월 ${billingDay}일 결제`
      : "저장했습니다. 결제일을 지정하면 청구서에 결제 예정일이 표시됩니다.",
  };
}

const invoiceSchema = z.object({
  userId: z.string().min(1, "회원을 선택하세요."),
  billingMonth: z.string().regex(BILLING_MONTH_RE, "청구 월 형식이 올바르지 않습니다."),
  title: z.string().trim().min(1, "항목명을 입력하세요.").max(60),
  amount: z.coerce.number().int().min(100, "금액은 100원 이상이어야 합니다."),
  memo: z.string().trim().max(200).optional(),
});

/** 개별 청구서 발행. 결제일을 비우면 회원의 결제일을 쓴다. notify가 있으면 문자 발송 */
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
  const dayInput = parseBillingDay(formData.get("billingDay"));
  if (dayInput !== null && typeof dayInput === "object") return dayInput;
  const notify = formData.get("notify") === "on";

  const { userId, billingMonth, title, amount, memo } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "WITHDRAWN") return { error: "유효한 회원이 아닙니다." };

  const existing = await prisma.invoice.findUnique({
    where: { userId_billingMonth: { userId, billingMonth } },
  });
  if (existing) {
    return { error: `${user.name} 회원에게 ${formatBillingMonth(billingMonth)} 청구서가 이미 있습니다.` };
  }

  const billingDay = dayInput ?? user.billingDay;
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      billingMonth,
      title,
      amount,
      memo: memo || null,
      dueDate: billingDay ? computeDueDate(billingMonth, billingDay) : null,
    },
    include: { user: { select: { phone: true } } },
  });

  let message = `${user.name} · ${formatBillingMonth(billingMonth)} 청구서를 발행했습니다.`;
  if (notify) {
    try {
      const sent = await notifyInvoice(invoice);
      message += sent ? " 안내 문자를 보냈습니다." : " (문자 미설정: 발송 생략)";
    } catch (e) {
      message += ` 문자 발송 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`;
    }
  }
  revalidateBilling();
  return { ok: true, message };
}

/**
 * 월 결제 설정된 활성 회원 전원에게 해당 월 청구서 일괄 생성 (이미 있으면 건너뜀).
 * 결제 예정일은 회원별 결제일로 계산하고, notify가 있으면 각자에게 문자를 보낸다.
 */
export async function generateMonthlyInvoices(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const billingMonth = String(formData.get("billingMonth") ?? "");
  if (!BILLING_MONTH_RE.test(billingMonth)) {
    return { error: "청구 월 형식이 올바르지 않습니다." };
  }
  const notify = formData.get("notify") === "on";

  const targets = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      monthlyAmount: { gt: 0 },
      invoices: { none: { billingMonth } },
    },
  });
  if (targets.length === 0) {
    return {
      ok: true,
      message: `${formatBillingMonth(billingMonth)} 청구 대상이 없습니다. (이미 발행되었거나 설정된 회원이 없음)`,
    };
  }

  const created = await prisma.$transaction(
    targets.map((user) =>
      prisma.invoice.create({
        data: {
          userId: user.id,
          billingMonth,
          title: user.monthlyTitle ?? "월 이용료",
          amount: user.monthlyAmount!,
          dueDate: user.billingDay ? computeDueDate(billingMonth, user.billingDay) : null,
        },
        include: { user: { select: { phone: true } } },
      })
    )
  );

  let message = `${formatBillingMonth(billingMonth)} 청구서 ${created.length}건을 생성했습니다.`;
  if (notify) {
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const invoice of created) {
      try {
        if (await notifyInvoice(invoice)) sent += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
    if (skipped === created.length) message += " (문자 미설정: 발송 생략)";
    else message += ` 문자 발송 ${sent}건${failed ? `, 실패 ${failed}건` : ""}.`;
  }
  revalidateBilling();
  return { ok: true, message };
}

/** 결제 예정 회원 목록에서 바로 발행: 회원의 월 결제 설정으로 청구서를 만들고 문자를 보낸다 */
export async function issueScheduledInvoice(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const billingMonth = String(formData.get("billingMonth") ?? "");
  const notify = formData.get("notify") !== "off";
  if (!userId || !BILLING_MONTH_RE.test(billingMonth)) {
    return { error: "요청이 올바르지 않습니다." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") return { error: "활성 회원이 아닙니다." };
  if (!user.monthlyAmount) return { error: "월 결제 금액이 설정되지 않은 회원입니다." };

  const existing = await prisma.invoice.findUnique({
    where: { userId_billingMonth: { userId, billingMonth } },
  });
  if (existing) {
    return { error: `${user.name} 회원의 ${formatBillingMonth(billingMonth)} 청구서가 이미 있습니다.` };
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      billingMonth,
      title: user.monthlyTitle ?? "월 이용료",
      amount: user.monthlyAmount,
      dueDate: user.billingDay ? computeDueDate(billingMonth, user.billingDay) : null,
    },
    include: { user: { select: { phone: true } } },
  });

  let message = `${user.name} · ${formatBillingMonth(billingMonth)} 청구서를 발행했습니다.`;
  if (notify) {
    try {
      const sent = await notifyInvoice(invoice);
      message += sent ? " 안내 문자를 보냈습니다." : " (문자 미설정: 발송 생략)";
    } catch (e) {
      message += ` 문자 발송 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`;
    }
  }
  revalidateBilling();
  return { ok: true, message };
}

/** 미납 청구서 안내 문자 (재)발송 */
export async function sendInvoiceNotice(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requireAdmin();

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { user: { select: { phone: true, name: true, status: true } } },
  });
  if (!invoice) return { error: "청구서를 찾을 수 없습니다." };
  if (invoice.status !== "UNPAID") return { error: "미납 청구서에만 문자를 보낼 수 있습니다." };
  if (invoice.user.status !== "ACTIVE") return { error: "활성 회원이 아닙니다." };

  try {
    const sent = await notifyInvoice(invoice);
    revalidateBilling();
    return sent
      ? { ok: true, message: `${invoice.user.name} 회원에게 문자를 보냈습니다.` }
      : { ok: true, message: "문자(SOLAPI)가 설정되지 않아 서버 콘솔에만 출력했습니다." };
  } catch (e) {
    return { error: `문자 발송 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}` };
  }
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
