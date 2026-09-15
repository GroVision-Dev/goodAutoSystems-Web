import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_REQUEST_TOKEN_RE,
  generatePaymentRequestToken,
  isValidPaymentRequestToken,
  maskName,
  paymentRequestCreateSchema,
  paymentRequestExpiresAt,
  paymentRequestSmsText,
  paymentRequestView,
} from "./payment-request";

describe("generatePaymentRequestToken", () => {
  test("43자 base64url 형식이고 매번 다르다", () => {
    const a = generatePaymentRequestToken();
    const b = generatePaymentRequestToken();
    assert.match(a, PAYMENT_REQUEST_TOKEN_RE);
    assert.notEqual(a, b);
  });

  test("isValidPaymentRequestToken은 형식만 통과시킨다", () => {
    assert.equal(isValidPaymentRequestToken(generatePaymentRequestToken()), true);
    assert.equal(isValidPaymentRequestToken("short"), false);
    assert.equal(isValidPaymentRequestToken(`${"a".repeat(42)}/`), false);
  });
});

describe("maskName", () => {
  test("3자 이상은 가운데를 가린다", () => {
    assert.equal(maskName("홍길동"), "홍*동");
    assert.equal(maskName("남궁민수"), "남**수");
  });

  test("2자는 뒤를, 1자는 그대로", () => {
    assert.equal(maskName("김철"), "김*");
    assert.equal(maskName("김"), "김");
  });
});

describe("paymentRequestSmsText", () => {
  test("이름·항목·금액(천 단위 구분)·링크를 담는다", () => {
    const text = paymentRequestSmsText({
      recipientName: "홍길동",
      title: "엑셀 자동화 구축비",
      amount: 1500000,
      url: "https://optix.goodautosys.kr/pay/abc",
    });
    assert.equal(
      text,
      "[Optix] 홍길동님 결제 요청: 엑셀 자동화 구축비 1,500,000원\nhttps://optix.goodautosys.kr/pay/abc"
    );
  });
});

describe("paymentRequestCreateSchema", () => {
  const valid = {
    recipientName: " 홍길동 ",
    recipientPhone: "010-1234-5678",
    title: "구축비",
    amount: "150000",
    memo: "",
    validDays: undefined,
  };

  test("정규화하고 유효기간 기본 7일, 빈 메모는 null", () => {
    assert.deepEqual(paymentRequestCreateSchema.parse(valid), {
      recipientName: "홍길동",
      recipientPhone: "01012345678",
      title: "구축비",
      amount: 150000,
      memo: null,
      validDays: 7,
    });
  });

  test("금액 100원 미만·1억 초과·소수는 거부", () => {
    for (const amount of ["99", "100000001", "1000.5"]) {
      assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, amount }).success, false, amount);
    }
  });

  test("유효기간 1~30일만 허용", () => {
    assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, validDays: "0" }).success, false);
    assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, validDays: "31" }).success, false);
    assert.equal(paymentRequestCreateSchema.parse({ ...valid, validDays: "30" }).validDays, 30);
  });

  test("휴대폰 형식 오류는 거부", () => {
    assert.equal(
      paymentRequestCreateSchema.safeParse({ ...valid, recipientPhone: "02-123-4567" }).success,
      false
    );
  });
});

describe("paymentRequestView / paymentRequestExpiresAt", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  test("PENDING은 유효기간 전이면 payable, 지나면(경계 포함) expired", () => {
    assert.equal(
      paymentRequestView({ status: "PENDING", expiresAt: new Date("2026-09-15T00:00:01Z") }, now),
      "payable"
    );
    assert.equal(paymentRequestView({ status: "PENDING", expiresAt: now }, now), "expired");
  });

  test("나머지 상태는 그대로 대응", () => {
    const expiresAt = new Date("2026-12-31T00:00:00Z");
    assert.equal(paymentRequestView({ status: "PAID", expiresAt }, now), "paid");
    assert.equal(paymentRequestView({ status: "CANCELED", expiresAt }, now), "canceled");
    assert.equal(paymentRequestView({ status: "EXPIRED", expiresAt }, now), "expired");
    assert.equal(paymentRequestView({ status: "REFUNDED", expiresAt }, now), "refunded");
  });

  test("유효기간은 now + N일", () => {
    assert.equal(paymentRequestExpiresAt(7, now).toISOString(), "2026-09-22T00:00:00.000Z");
  });
});
