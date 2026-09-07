import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, formatPhone } from "./phone";

describe("normalizePhone", () => {
  test("하이픈을 제거한다", () => {
    assert.equal(normalizePhone("010-1234-5678"), "01012345678");
  });

  test("공백·괄호를 제거한다", () => {
    assert.equal(normalizePhone(" 010 1234 5678 "), "01012345678");
  });

  test("이미 숫자만이면 그대로", () => {
    assert.equal(normalizePhone("01012345678"), "01012345678");
  });

  test("10자리는 거부", () => {
    assert.equal(normalizePhone("010-123-4567"), null);
  });

  test("011로 시작하면 거부", () => {
    assert.equal(normalizePhone("011-1234-5678"), null);
  });

  test("숫자 외 문자가 섞이면 거부", () => {
    assert.equal(normalizePhone("0101234567a"), null);
  });

  test("빈 문자열은 거부", () => {
    assert.equal(normalizePhone(""), null);
  });
});

describe("formatPhone", () => {
  test("11자리를 3-4-4로 나눈다", () => {
    assert.equal(formatPhone("01012345678"), "010-1234-5678");
  });

  test("형식이 다르면 입력 그대로", () => {
    assert.equal(formatPhone("withdrawn-abc"), "withdrawn-abc");
  });
});
