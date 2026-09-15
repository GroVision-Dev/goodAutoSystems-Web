import { prisma } from "@/lib/prisma";

/** 결제창을 연 뒤 이 시간 안에 결제하지 않은 주문은 자동 만료 */
export const PENDING_ORDER_TTL_MINUTES = 60;
export const PENDING_ORDER_TTL_MS = PENDING_ORDER_TTL_MINUTES * 60 * 1000;
export const EXPIRED_ORDER_REASON = "결제 미완료 (자동 만료)";

/**
 * 오래된 결제 대기(PENDING) 주문을 EXPIRED로 정리한다.
 * 만료 뒤에 결제가 도착해도 payment-sync가 포트원 조회 결과로 PAID 처리한다.
 */
export async function expireStalePendingOrders(now: Date = new Date()): Promise<number> {
  const result = await prisma.order.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(now.getTime() - PENDING_ORDER_TTL_MS) },
    },
    data: { status: "EXPIRED", failReason: EXPIRED_ORDER_REASON },
  });
  return result.count;
}

/** 유효기간이 지난 결제 대기 요청을 EXPIRED로 정리한다 (결제창이 열린 채 늦게 결제되면 payment-sync가 PAID로 인정) */
export async function expireStalePaymentRequests(now: Date = new Date()): Promise<number> {
  const result = await prisma.paymentRequest.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
