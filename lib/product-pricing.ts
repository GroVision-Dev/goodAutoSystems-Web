/**
 * 상품 가격·결제 유형 표기 유틸.
 * ONE_TIME: 총액 1회 결제 / MONTHLY: 1개월 이용료 기준, 첫 달은 주문 결제·이후 청구서
 */

export interface PricedProduct {
  price: number;
  billingType: "ONE_TIME" | "MONTHLY";
  minMonths?: number | null;
  maxMonths?: number | null;
  category?: "PROGRAM" | "AI_SERVICE";
}

export function isMonthly(product: Pick<PricedProduct, "billingType">): boolean {
  return product.billingType === "MONTHLY";
}

/** "1~3개월" / "3개월" / "1개월 이상" / null */
export function contractRangeLabel(
  product: Pick<PricedProduct, "minMonths" | "maxMonths">
): string | null {
  const min = product.minMonths ?? null;
  const max = product.maxMonths ?? null;
  if (min && max) return min === max ? `${min}개월` : `${min}~${max}개월`;
  if (min) return `${min}개월 이상`;
  if (max) return `최대 ${max}개월`;
  return null;
}

/** 가격 앞에 붙는 단위 접두어. 월 결제면 "월 " */
export function pricePrefix(product: Pick<PricedProduct, "billingType">): string {
  return isMonthly(product) ? "월 " : "";
}

/** "월 2,500,000원" / "300,000원" */
export function priceLabel(product: Pick<PricedProduct, "price" | "billingType">): string {
  return `${pricePrefix(product)}${product.price.toLocaleString()}원`;
}

/** 가격 아래 보조 문구 (부가세 문구 제외). 예: "1~3개월 용역 계약 · 매월 결제" */
export function billingNote(product: PricedProduct): string {
  if (isMonthly(product)) {
    const range = contractRangeLabel(product);
    return `${range ? `${range} 용역 계약 · ` : ""}매월 결제`;
  }
  return product.category === "PROGRAM" ? "1회 결제 · 영구 사용권" : "1회 결제";
}
