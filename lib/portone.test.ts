import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getPayment,
  cancelPayment,
  verifyPaidPayment,
  PortOneApiError,
  type PortOnePayment,
} from "./portone";

const originalFetch = globalThis.fetch;

function paidPayment(overrides: Partial<PortOnePayment> = {}): PortOnePayment {
  return {
    id: "GAS-123-abc",
    status: "PAID",
    transactionId: "tx-001",
    amount: { total: 50000 },
    currency: "KRW",
    ...overrides,
  };
}

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  process.env.PORTONE_API_SECRET = "test-api-secret";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("verifyPaidPayment", () => {
  test("결제 완료 상태이고 금액이 일치하면 통과한다", () => {
    verifyPaidPayment(paidPayment(), 50000);
  });

  test("결제 완료 상태가 아니면 실패한다", () => {
    assert.throws(
      () => verifyPaidPayment(paidPayment({ status: "READY" }), 50000),
      PortOneApiError
    );
  });

  test("금액이 다르면 실패한다", () => {
    assert.throws(() => verifyPaidPayment(paidPayment(), 49000), PortOneApiError);
  });

  test("통화가 KRW가 아니면 실패한다", () => {
    assert.throws(
      () => verifyPaidPayment(paidPayment({ currency: "USD" }), 50000),
      PortOneApiError
    );
  });
});

describe("getPayment", () => {
  test("결제 단건 조회 API를 호출해 결제 정보를 반환한다", async () => {
    const calls = mockFetch(200, paidPayment());
    const payment = await getPayment("GAS-123-abc");
    assert.equal(payment.status, "PAID");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.portone.io/payments/GAS-123-abc");
    assert.match(
      new Headers(calls[0].init?.headers).get("Authorization") ?? "",
      /^PortOne test-api-secret$/
    );
  });

  test("API 오류 응답이면 메시지를 담아 실패한다", async () => {
    mockFetch(404, { type: "PAYMENT_NOT_FOUND", message: "결제 건이 존재하지 않습니다." });
    await assert.rejects(getPayment("GAS-none"), (e: unknown) => {
      assert.ok(e instanceof PortOneApiError);
      assert.equal(e.message, "결제 건이 존재하지 않습니다.");
      assert.equal(e.type, "PAYMENT_NOT_FOUND");
      return true;
    });
  });

  test("시크릿이 없으면 실패한다", async () => {
    delete process.env.PORTONE_API_SECRET;
    await assert.rejects(getPayment("GAS-123-abc"), PortOneApiError);
  });
});

describe("cancelPayment", () => {
  test("결제 취소 API를 호출한다", async () => {
    const calls = mockFetch(200, { cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("GAS-123-abc", "관리자 취소");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.portone.io/payments/GAS-123-abc/cancel");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { reason: "관리자 취소" });
  });

  test("취소 실패 응답이면 메시지를 담아 실패한다", async () => {
    mockFetch(409, {
      type: "PAYMENT_ALREADY_CANCELLED",
      message: "이미 취소된 결제입니다.",
    });
    await assert.rejects(cancelPayment("GAS-123-abc", "사유"), (e: unknown) => {
      assert.ok(e instanceof PortOneApiError);
      assert.equal(e.message, "이미 취소된 결제입니다.");
      return true;
    });
  });
});
