import { randomBytes } from "node:crypto";

/** 추측 불가능한 주문번호 (포트원 paymentId로도 사용) */
export function newOrderId(): string {
  return `GAS-${Date.now()}-${randomBytes(6).toString("hex")}`;
}
