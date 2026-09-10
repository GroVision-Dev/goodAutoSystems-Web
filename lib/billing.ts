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

/** 청구서 결제 시 PG에 넘길 주문명 */
export function invoiceOrderName(title: string, month: string): string {
  return `${formatBillingMonth(month)} ${title}`;
}

/** 해당 월의 마지막 날짜 (28~31) */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * 청구 월 + 결제일(1~31) → 결제 예정일.
 * 그 달에 없는 날짜(예: 2월 30일)는 말일로 맞춘다. 시간은 로컬 자정.
 */
export function computeDueDate(month: string, billingDay: number): Date {
  const [y, m] = month.split("-").map(Number);
  const day = Math.min(Math.max(1, Math.trunc(billingDay)), daysInMonth(month));
  return new Date(y, m - 1, day);
}

/** 결제 예정일을 "9월 15일" 형식으로 */
export function formatDueDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 오늘(로컬 자정 기준)부터 결제 예정일까지 남은 일수. 음수면 지난 것 */
export function daysUntil(date: Date, now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** 미납 청구서가 결제 예정일을 지났는지 */
export function isOverdue(
  invoice: { status: string; dueDate: Date | null },
  now = new Date()
): boolean {
  return invoice.status === "UNPAID" && !!invoice.dueDate && daysUntil(invoice.dueDate, now) < 0;
}

/** 청구서 안내 문자 본문 */
export function invoiceSmsText(input: {
  title: string;
  billingMonth: string;
  amount: number;
  dueDate: Date | null;
  siteUrl: string;
}): string {
  const due = input.dueDate ? ` 결제일 ${formatDueDate(input.dueDate)}.` : "";
  return (
    `[Optix] ${formatBillingMonth(input.billingMonth)} ${input.title} ` +
    `${input.amount.toLocaleString()}원 청구서가 발행되었습니다.${due} ` +
    `마이페이지에서 결제해 주세요. ${input.siteUrl}/mypage`
  );
}
