import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeDueDate,
  daysInMonth,
  daysUntil,
  formatDueDate,
  invoiceSmsText,
  isOverdue,
} from "./billing";

describe("computeDueDate", () => {
  test("청구 월과 결제일로 날짜를 만든다", () => {
    const d = computeDueDate("2026-09", 15);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 15);
  });

  test("그 달에 없는 날짜는 말일로 맞춘다", () => {
    assert.equal(computeDueDate("2026-02", 31).getDate(), 28);
    assert.equal(computeDueDate("2028-02", 30).getDate(), 29);
    assert.equal(computeDueDate("2026-04", 31).getDate(), 30);
  });

  test("범위 밖 값은 1~말일로 보정한다", () => {
    assert.equal(computeDueDate("2026-09", 0).getDate(), 1);
    assert.equal(computeDueDate("2026-09", 99).getDate(), 30);
  });
});

describe("daysInMonth", () => {
  test("월별 일수", () => {
    assert.equal(daysInMonth("2026-01"), 31);
    assert.equal(daysInMonth("2026-02"), 28);
    assert.equal(daysInMonth("2028-02"), 29);
  });
});

describe("daysUntil / isOverdue", () => {
  const today = new Date(2026, 8, 10, 15, 30);

  test("남은 일수 계산 (시간은 무시)", () => {
    assert.equal(daysUntil(new Date(2026, 8, 15), today), 5);
    assert.equal(daysUntil(new Date(2026, 8, 10, 1), today), 0);
    assert.equal(daysUntil(new Date(2026, 8, 8), today), -2);
  });

  test("미납이면서 결제 예정일이 지났을 때만 연체", () => {
    assert.equal(isOverdue({ status: "UNPAID", dueDate: new Date(2026, 8, 8) }, today), true);
    assert.equal(isOverdue({ status: "UNPAID", dueDate: new Date(2026, 8, 10) }, today), false);
    assert.equal(isOverdue({ status: "PAID", dueDate: new Date(2026, 8, 8) }, today), false);
    assert.equal(isOverdue({ status: "UNPAID", dueDate: null }, today), false);
  });
});

describe("invoiceSmsText", () => {
  test("월·항목·금액·결제일·링크를 담는다", () => {
    const text = invoiceSmsText({
      title: "월 이용료",
      billingMonth: "2026-09",
      amount: 50000,
      dueDate: new Date(2026, 8, 15),
      siteUrl: "https://optix.goodautosys.kr",
    });
    assert.equal(
      text,
      "[Optix] 2026년 9월 월 이용료 50,000원 청구서가 발행되었습니다. 결제일 9월 15일. 마이페이지에서 결제해 주세요. https://optix.goodautosys.kr/mypage"
    );
  });

  test("결제일이 없으면 결제일 문구를 뺀다", () => {
    const text = invoiceSmsText({
      title: "월 이용료",
      billingMonth: "2026-09",
      amount: 50000,
      dueDate: null,
      siteUrl: "https://example.test",
    });
    assert.ok(!text.includes("결제일"));
  });

  test("formatDueDate", () => {
    assert.equal(formatDueDate(new Date(2026, 0, 5)), "1월 5일");
  });
});
