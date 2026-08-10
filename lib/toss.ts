export interface TossPaymentResult {
  paymentKey: string;
  orderId: string;
  totalAmount: number;
  method?: string;
  approvedAt?: string;
  [key: string]: unknown;
}

export class TossConfirmError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "TossConfirmError";
  }
}

/** 토스페이먼츠 결제 승인 API 호출 (서버 전용) */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<TossPaymentResult> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new TossConfirmError("TOSS_SECRET_KEY가 설정되지 않았습니다.");

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new TossConfirmError(
      data?.message ?? "결제 승인에 실패했습니다.",
      data?.code
    );
  }
  return data as TossPaymentResult;
}
