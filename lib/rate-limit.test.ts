import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits, getClientIp } from "./rate-limit";

const HOUR = 60 * 60 * 1000;

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  test("한도 안에서는 ok", () => {
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(checkRateLimit("ip:1", 3, HOUR, 1000 + i), {
        ok: true,
        retryAfterSeconds: 0,
      });
    }
  });

  test("한도를 넘기면 거부하고 대기 시간을 알려준다", () => {
    checkRateLimit("ip:1", 2, HOUR, 0);
    checkRateLimit("ip:1", 2, HOUR, 1000);
    const result = checkRateLimit("ip:1", 2, HOUR, 2000);
    assert.equal(result.ok, false);
    // 첫 호출(0ms) 기준 윈도우 만료까지 = 1시간 - 2초
    assert.equal(result.retryAfterSeconds, 3598);
  });

  test("윈도우가 지나면 다시 허용", () => {
    checkRateLimit("ip:1", 1, HOUR, 0);
    assert.equal(checkRateLimit("ip:1", 1, HOUR, 10).ok, false);
    assert.equal(checkRateLimit("ip:1", 1, HOUR, HOUR + 1).ok, true);
  });

  test("키가 다르면 서로 영향 없음", () => {
    checkRateLimit("ip:1", 1, HOUR, 0);
    assert.equal(checkRateLimit("ip:2", 1, HOUR, 0).ok, true);
  });
});

describe("getClientIp", () => {
  test("x-forwarded-for 첫 값을 쓴다", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  test("없으면 x-real-ip, 그것도 없으면 unknown", () => {
    assert.equal(
      getClientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } })),
      "5.6.7.8"
    );
    assert.equal(getClientIp(new Request("http://x")), "unknown");
  });
});
