import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PortOneWebhookError,
  signPortOneWebhook,
  verifyPortOneWebhook,
} from "./portone-webhook";

const SECRET_B64 = Buffer.from("test-webhook-secret-bytes").toString("base64");
const SECRET = `whsec_${SECRET_B64}`;
const NOW = new Date("2026-09-14T03:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));
const BODY = JSON.stringify({
  type: "Transaction.Paid",
  timestamp: "2026-09-14T03:00:00Z",
  data: { paymentId: "GAS-1-abc", storeId: "store-1", transactionId: "tx-1" },
});

function headersFor(signature: string, overrides: Record<string, string> = {}) {
  return new Headers({
    "webhook-id": "msg_1",
    "webhook-timestamp": TS,
    "webhook-signature": signature,
    ...overrides,
  });
}

function reasonOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof PortOneWebhookError) return e.reason;
    throw e;
  }
  return undefined;
}

describe("verifyPortOneWebhook", () => {
  test("올바른 서명이면 본문을 파싱해 돌려준다", () => {
    const sig = signPortOneWebhook(SECRET, "msg_1", TS, BODY);
    const payload = verifyPortOneWebhook(SECRET, BODY, headersFor(`v1,${sig}`), NOW);
    assert.equal(payload.type, "Transaction.Paid");
    assert.equal(payload.data?.paymentId, "GAS-1-abc");
  });

  test("whsec_ 접두어 없는 시크릿도 같은 서명으로 검증된다", () => {
    const sig = signPortOneWebhook(SECRET, "msg_1", TS, BODY);
    assert.doesNotThrow(() => verifyPortOneWebhook(SECRET_B64, BODY, headersFor(`v1,${sig}`), NOW));
  });

  test("대소문자가 다른 일반 객체 헤더도 받는다", () => {
    const sig = signPortOneWebhook(SECRET, "msg_1", TS, BODY);
    const payload = verifyPortOneWebhook(
      SECRET,
      BODY,
      { "Webhook-Id": "msg_1", "Webhook-Timestamp": TS, "Webhook-Signature": `v1,${sig}` },
      NOW
    );
    assert.equal(payload.type, "Transaction.Paid");
  });

  test("다른 시크릿으로 만든 서명은 거부", () => {
    const other = `whsec_${Buffer.from("other-secret").toString("base64")}`;
    const sig = signPortOneWebhook(other, "msg_1", TS, BODY);
    assert.equal(
      reasonOf(() => verifyPortOneWebhook(SECRET, BODY, headersFor(`v1,${sig}`), NOW)),
      "NO_MATCHING_SIGNATURE"
    );
  });

  test("본문이 변조되면 거부", () => {
    const sig = signPortOneWebhook(SECRET, "msg_1", TS, BODY);
    const tampered = BODY.replace("GAS-1-abc", "GAS-2-xyz");
    assert.equal(
      reasonOf(() => verifyPortOneWebhook(SECRET, tampered, headersFor(`v1,${sig}`), NOW)),
      "NO_MATCHING_SIGNATURE"
    );
  });

  test("5분 넘게 지난 타임스탬프는 거부", () => {
    const oldTs = String(Number(TS) - 301);
    const sig = signPortOneWebhook(SECRET, "msg_1", oldTs, BODY);
    assert.equal(
      reasonOf(() =>
        verifyPortOneWebhook(SECRET, BODY, headersFor(`v1,${sig}`, { "webhook-timestamp": oldTs }), NOW)
      ),
      "TIMESTAMP_TOO_OLD"
    );
  });

  test("여러 서명 중 하나만 맞아도 통과", () => {
    const sig = signPortOneWebhook(SECRET, "msg_1", TS, BODY);
    const bogus = Buffer.from("x".repeat(32)).toString("base64");
    assert.doesNotThrow(() =>
      verifyPortOneWebhook(SECRET, BODY, headersFor(`v2,${sig} v1,${bogus} v1,${sig}`), NOW)
    );
  });

  test("필수 헤더가 없으면 거부", () => {
    assert.equal(
      reasonOf(() => verifyPortOneWebhook(SECRET, BODY, new Headers({ "webhook-id": "msg_1" }), NOW)),
      "MISSING_REQUIRED_HEADERS"
    );
  });
});
