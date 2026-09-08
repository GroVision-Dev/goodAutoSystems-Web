/** 월 청구서 공통 유틸 */

export const INVOICE_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  UNPAID: { label: "미납", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "납부 완료", className: "bg-accent/15 text-accent" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
};

/** "YYYY-MM" 형식 검증 */
export const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 현재 월을 "YYYY-MM"으로 */
export function currentBillingMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08" → "2026년 8월" */
export function formatBillingMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** 청구서 결제 시 토스에 넘길 주문명 */
export function invoiceOrderName(title: string, month: string): string {
  return `${formatBillingMonth(month)} ${title}`;
}
