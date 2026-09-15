import { prisma } from "@/lib/prisma";
import {
  cancelPayment,
  getPayment,
  methodLabel,
  PortOneApiError,
  type PortOnePayment,
} from "@/lib/portone";
import { setupMonthlyBillingAfterPurchase } from "@/lib/monthly-purchase";
import { writeAudit } from "@/lib/audit";
import { alertAdmin } from "@/lib/alert";

/**
 * 포트원 결제 상태를 서버 주문에 반영하는 단일 진입점.
 * 결제 완료 페이지와 웹훅이 모두 이 함수를 호출한다.
 * - 클라이언트·웹훅 본문의 금액/상태는 믿지 않고 항상 포트원 결제 단건 조회 결과로 판단한다.
 * - 상태 전환은 조건부 updateMany로 처리해 웹훅과 결제 완료 페이지가 동시에 와도 한 번만 처리된다.
 * - 금액 불일치·중복 결제는 자동으로 결제 취소(환불)한다.
 */

export type PaymentSyncSource = "webhook" | "success_page";

export type PaymentSyncResult =
  | { status: "paid" }
  | { status: "pending"; message: string }
  | { status: "failed"; message: string }
  | { status: "refunded"; message: string }
  | { status: "canceled"; message: string }
  | { status: "not_found" };

const MISMATCH_MESSAGE = "결제 금액이 주문 금액과 일치하지 않아 결제가 자동 취소되었습니다.";
const DUPLICATE_MESSAGE =
  "이미 결제가 완료되었거나 취소된 요청이라 이번 결제는 자동으로 환불 처리되었습니다.";

type DuplicateKind = "invoice" | "one_time" | "payment_request";

class DuplicatePaymentError extends Error {
  constructor(public readonly kind: DuplicateKind) {
    super(`중복 결제: ${kind}`);
  }
}

type OrderWithProduct = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function loadOrder(orderId: string) {
  return prisma.order.findUnique({ where: { orderId }, include: { product: true } });
}

export async function syncPaymentFromPortOne(
  orderId: string,
  opts: { source: PaymentSyncSource }
): Promise<PaymentSyncResult> {
  const order = await loadOrder(orderId);
  if (!order) return { status: "not_found" };

  let payment: PortOnePayment;
  try {
    // 포트원 paymentId = 주문번호(orderId)
    payment = await getPayment(orderId);
  } catch (e) {
    if (e instanceof PortOneApiError && e.type === "PAYMENT_NOT_FOUND") {
      return order.status === "PAID"
        ? { status: "paid" }
        : { status: "pending", message: "결제 내역을 찾을 수 없습니다. 결제를 다시 진행해 주세요." };
    }
    throw e;
  }

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  if (storeId && payment.storeId && payment.storeId !== storeId) {
    console.error("[payment-sync] 상점 아이디 불일치", orderId, payment.storeId);
    return { status: "failed", message: "결제 정보가 올바르지 않습니다." };
  }

  switch (payment.status) {
    case "PAID":
      return handlePaid(order, payment, opts.source);
    case "CANCELLED":
    case "PARTIAL_CANCELLED":
      return handleCancelled(order, payment, opts.source);
    case "FAILED":
      await prisma.order.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "FAILED", failReason: "결제 실패" },
      });
      return { status: "failed", message: "결제가 완료되지 않았습니다." };
    default:
      if (order.status === "PAID") return { status: "paid" };
      return {
        status: "pending",
        message: "결제 확인이 아직 완료되지 않았습니다. 잠시 후 마이페이지에서 결제 상태를 확인해 주세요.",
      };
  }
}

async function handlePaid(
  order: OrderWithProduct,
  payment: PortOnePayment,
  source: PaymentSyncSource
): Promise<PaymentSyncResult> {
  if (order.status === "PAID") return { status: "paid" };
  const { orderId } = order;

  const amountOk =
    payment.amount?.total === order.amount && (!payment.currency || payment.currency === "KRW");
  if (!amountOk) {
    const refunded = await tryCancel(orderId, "결제 금액 불일치 자동 취소");
    await prisma.order.updateMany({
      where: { orderId, status: { not: "PAID" } },
      data: {
        status: "FAILED",
        paymentKey: payment.transactionId ?? null,
        failReason: refunded
          ? "결제 금액 불일치 (자동 취소됨)"
          : "결제 금액 불일치 (자동 취소 실패 — 관리자 확인 필요)",
      },
    });
    await writeAudit({
      action: "PAYMENT_AMOUNT_MISMATCH",
      targetType: "order",
      targetId: orderId,
      detail: {
        expected: order.amount,
        actual: payment.amount?.total ?? null,
        currency: payment.currency ?? null,
        refunded,
        source,
      },
      ...(source === "webhook" ? { ip: null, userAgent: null } : {}),
    });
    await alertAdmin(
      `amount-mismatch:${orderId}`,
      `결제 금액 불일치 ${orderId}: 주문 ${order.amount}원 / 결제 ${payment.amount?.total ?? "?"}원 (${refunded ? "자동 취소됨" : "자동 취소 실패, 확인 필요"})`
    );
    return { status: "failed", message: MISMATCH_MESSAGE };
  }

  const paidAt = new Date();
  let claimed = false;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { orderId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paymentKey: payment.transactionId ?? null,
          method: methodLabel(payment),
          failReason: null,
          paidAt,
        },
      });
      if (claim.count !== 1) return false;

      // 1회 결제 상품(영구 사용권)을 같은 회원이 다른 주문으로 이미 결제했으면 중복
      if (order.product?.billingType === "ONE_TIME" && order.productId && order.userId) {
        const other = await tx.order.findFirst({
          where: {
            userId: order.userId,
            productId: order.productId,
            status: "PAID",
            orderId: { not: orderId },
          },
          select: { id: true },
        });
        if (other) throw new DuplicatePaymentError("one_time");
      }

      // 청구서는 미납 상태일 때만 납부 처리 (다른 주문으로 이미 납부·취소된 청구서면 중복)
      if (order.invoiceId) {
        const invoice = await tx.invoice.updateMany({
          where: { id: order.invoiceId, status: "UNPAID" },
          data: { status: "PAID", paidAt },
        });
        if (invoice.count !== 1) throw new DuplicatePaymentError("invoice");
      }

      // 비회원 단건 결제 요청은 대기·만료 상태일 때만 결제 완료 처리 (이미 결제·취소·환불된 요청이면 중복)
      if (order.paymentRequestId) {
        const request = await tx.paymentRequest.updateMany({
          where: { id: order.paymentRequestId, status: { in: ["PENDING", "EXPIRED"] } },
          data: { status: "PAID", paidAt },
        });
        if (request.count !== 1) throw new DuplicatePaymentError("payment_request");
      }
      return true;
    });
  } catch (e) {
    if (!(e instanceof DuplicatePaymentError)) throw e;
    return refundDuplicate(order, payment, source, e.kind);
  }

  // 웹훅과 결제 완료 페이지가 동시에 도착한 경우 먼저 처리한 쪽만 후속 작업을 한다
  if (!claimed) return { status: "paid" };

  if (order.product?.billingType === "MONTHLY" && order.userId) {
    try {
      await setupMonthlyBillingAfterPurchase({
        orderId,
        userId: order.userId,
        product: { name: order.product.name, price: order.product.price },
        paidAt,
      });
    } catch (e) {
      console.error("[payment-sync] 월 결제 설정 등록 실패", orderId, e);
    }
  }

  await writeAudit({
    action: "PAYMENT_CONFIRMED",
    targetType: "order",
    targetId: orderId,
    detail: { amount: order.amount, source },
    ...(source === "webhook" ? { ip: null, userAgent: null } : {}),
  });
  return { status: "paid" };
}

async function refundDuplicate(
  order: OrderWithProduct,
  payment: PortOnePayment,
  source: PaymentSyncSource,
  kind: DuplicateKind
): Promise<PaymentSyncResult> {
  const { orderId } = order;
  const refunded = await tryCancel(orderId, "중복 결제 자동 환불");
  await prisma.order.updateMany({
    where: { orderId, status: { not: "PAID" } },
    data: refunded
      ? { status: "CANCELED", paymentKey: payment.transactionId ?? null, failReason: "중복 결제 자동 환불" }
      : {
          status: "FAILED",
          paymentKey: payment.transactionId ?? null,
          failReason: "중복 결제 — 자동 환불 실패, 관리자 확인 필요",
        },
  });
  await writeAudit({
    action: "PAYMENT_DUPLICATE_REFUNDED",
    targetType: "order",
    targetId: orderId,
    detail: { amount: order.amount, kind, refunded, source },
    ...(source === "webhook" ? { ip: null, userAgent: null } : {}),
  });
  if (!refunded) {
    await alertAdmin(`duplicate-refund-failed:${orderId}`, `중복 결제 자동 환불 실패 ${orderId} (${order.amount}원), 수동 환불 필요`);
    return {
      status: "failed",
      message: "중복 결제가 확인되었습니다. 환불 처리를 위해 고객센터로 문의해 주세요.",
    };
  }
  return { status: "refunded", message: DUPLICATE_MESSAGE };
}

async function handleCancelled(
  order: OrderWithProduct,
  payment: PortOnePayment,
  source: PaymentSyncSource
): Promise<PaymentSyncResult> {
  const { orderId } = order;
  const partial = payment.status === "PARTIAL_CANCELLED";

  if (order.status === "PAID") {
    const changed = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { orderId, status: "PAID" },
        data: { status: "CANCELED", failReason: partial ? "포트원에서 부분 취소됨" : "포트원에서 취소됨" },
      });
      if (claim.count !== 1) return false;
      // 청구서 결제가 취소되면 청구서는 다시 미납으로 (관리자 결제취소와 동일)
      if (order.invoiceId) {
        await tx.invoice.updateMany({
          where: { id: order.invoiceId, status: "PAID" },
          data: { status: "UNPAID", paidAt: null },
        });
      }
      if (order.paymentRequestId) {
        await tx.paymentRequest.updateMany({
          where: { id: order.paymentRequestId, status: "PAID" },
          data: { status: "REFUNDED", canceledAt: new Date() },
        });
      }
      return true;
    });
    if (changed) {
      await writeAudit({
        action: "PAYMENT_CANCELED_SYNC",
        targetType: "order",
        targetId: orderId,
        detail: { amount: order.amount, partial, source },
        ...(source === "webhook" ? { ip: null, userAgent: null } : {}),
      });
    }
  }
  return { status: "canceled", message: "취소된 결제입니다." };
}

/** 포트원 결제 취소. 실패해도 예외를 던지지 않고 false */
async function tryCancel(orderId: string, reason: string): Promise<boolean> {
  try {
    await cancelPayment(orderId, reason);
    return true;
  } catch (e) {
    if (e instanceof PortOneApiError && e.type === "PAYMENT_ALREADY_CANCELLED") return true;
    console.error("[payment-sync] 자동 결제 취소 실패", orderId, e);
    return false;
  }
}
