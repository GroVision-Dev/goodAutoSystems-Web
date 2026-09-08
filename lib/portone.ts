const API_BASE = "https://api.portone.io";

export interface PortOnePayment {
  id: string;
  status: string;
  transactionId: string;
  amount: { total: number; [key: string]: unknown };
  currency?: string;
  method?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export class PortOneApiError extends Error {
  constructor(
    message: string,
    public readonly type?: string
  ) {
    super(message);
    this.name = "PortOneApiError";
  }
}

function authHeaders(): Record<string, string> {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new PortOneApiError("PORTONE_API_SECRET가 설정되지 않았습니다.");
  return {
    Authorization: `PortOne ${secret}`,
    "Content-Type": "application/json",
  };
}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new PortOneApiError(data?.message ?? fallbackMessage, data?.type);
  }
  return data as T;
}

/** 포트원 결제 단건 조회 API 호출 (서버 전용) */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  return parseOrThrow<PortOnePayment>(res, "결제 조회에 실패했습니다.");
}

/** 포트원 결제 취소(환불) API 호출 (서버 전용) */
export async function cancelPayment(paymentId: string, reason: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
      cache: "no-store",
    }
  );
  await parseOrThrow(res, "결제 취소에 실패했습니다.");
}

/** 조회한 결제가 결제 완료 상태이고 주문 금액·통화와 일치하는지 검증 */
export function verifyPaidPayment(payment: PortOnePayment, expectedAmount: number): void {
  if (payment.status !== "PAID") {
    throw new PortOneApiError(`결제가 완료되지 않았습니다. (상태: ${payment.status})`);
  }
  if (payment.amount.total !== expectedAmount) {
    throw new PortOneApiError("결제 금액이 주문 금액과 일치하지 않습니다.");
  }
  if (payment.currency && payment.currency !== "KRW") {
    throw new PortOneApiError("원화 결제가 아닙니다.");
  }
}

const METHOD_LABELS: Record<string, string> = {
  PaymentMethodCard: "카드",
  PaymentMethodEasyPay: "간편결제",
  PaymentMethodTransfer: "계좌이체",
  PaymentMethodVirtualAccount: "가상계좌",
  PaymentMethodMobile: "휴대폰결제",
  PaymentMethodGiftCertificate: "상품권",
};

/** 결제수단을 관리자 화면 표기용 한글 라벨로 변환 */
export function methodLabel(payment: PortOnePayment): string | null {
  const type = payment.method?.type;
  if (!type) return null;
  return METHOD_LABELS[type] ?? type;
}
