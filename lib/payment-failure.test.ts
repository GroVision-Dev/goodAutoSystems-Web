import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatPaymentFailure, safeErrorCode } from "./payment-failure";

describe("safeErrorCode", () => {
  test("영문·숫자·밑줄·하이픈만 남기고 40자로 자른다", () => {
    assert.equal(safeErrorCode("PG_PROVIDER_ERROR"), "PG_PROVIDER_ERROR");
    assert.equal(safeErrorCode("<script>alert(1)</script>"), "scriptalert1script");
    assert.equal(safeErrorCode("A".repeat(50)).length, 40);
  });

  test("값이 없으면 빈 문자열", () => {
    assert.equal(safeErrorCode(undefined), "");
  });
});

describe("formatPaymentFailure", () => {
  test("PG 코드·메시지가 있으면 failReason과 화면 문구에 모두 포함한다", () => {
    const r = formatPaymentFailure({
      code: "PG_PROVIDER_ERROR",
      message: "PG사에서 오류가 발생했습니다.",
      pgCode: "E1234",
      pgMessage: "카드사 승인 거절",
    });
    assert.equal(r.code, "PG_PROVIDER_ERROR");
    assert.equal(r.pgCode, "E1234");
    assert.equal(r.pgMessage, "카드사 승인 거절");
    assert.equal(r.failReason, "[PG_PROVIDER_ERROR] PG사에서 오류가 발생했습니다. | PG E1234: 카드사 승인 거절");
  });

  test("PG 정보가 없으면 포트원 코드·메시지만 남긴다", () => {
    const r = formatPaymentFailure({ code: "FAILURE_TYPE_PG", message: "사용자가 결제를 취소했습니다." });
    assert.equal(r.failReason, "[FAILURE_TYPE_PG] 사용자가 결제를 취소했습니다.");
    assert.equal(r.pgCode, "");
    assert.equal(r.pgMessage, "");
  });

  test("메시지가 없으면 코드만으로 failReason을 만든다", () => {
    const r = formatPaymentFailure({ code: "PG_PROVIDER_ERROR" });
    assert.equal(r.failReason, "결제 실패 (PG_PROVIDER_ERROR)");
  });

  test("failReason은 200자, pgMessage는 200자로 자르고 제어문자를 제거한다", () => {
    const r = formatPaymentFailure({
      code: "PG_PROVIDER_ERROR",
      message: "m".repeat(300),
      pgCode: "E1",
      pgMessage: "a\u0000b\nc" + "x".repeat(300),
    });
    assert.equal(r.failReason.length, 200);
    assert.equal(r.pgMessage.length, 200);
    assert.ok(r.pgMessage.startsWith("abc"));
  });

  test("pgCode도 안전한 문자만 남긴다", () => {
    const r = formatPaymentFailure({ code: "X", pgCode: "<E-1>", pgMessage: "m" });
    assert.equal(r.pgCode, "E-1");
  });
});
