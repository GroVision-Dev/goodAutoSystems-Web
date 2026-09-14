import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  clearRateLimit,
  getClientIp,
  isRateLimited,
  recordHit,
  resetRateLimits,
} from "./rate-limit";

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

describe("isRateLimited / recordHit", () => {
  test("기록만 쌓고, 한도에 도달하면 limited", () => {
    assert.equal(isRateLimited("fail:a", 2, HOUR, 0).limited, false);
    recordHit("fail:a", 0);
    assert.equal(isRateLimited("fail:a", 2, HOUR, 10).limited, false);
    recordHit("fail:a", 20);
    const result = isRateLimited("fail:a", 2, HOUR, 30);
    assert.equal(result.limited, true);
    assert.equal(result.retryAfterSeconds, 3600);
  });

  test("판정만으로는 기록이 늘지 않는다", () => {
    for (let i = 0; i < 10; i++) isRateLimited("fail:b", 1, HOUR, i);
    assert.equal(isRateLimited("fail:b", 1, HOUR, 20).limited, false);
  });

  test("clearRateLimit으로 초기화", () => {
    recordHit("fail:c", 0);
    clearRateLimit("fail:c");
    assert.equal(isRateLimited("fail:c", 1, HOUR, 10).limited, false);
  });
});

describe("getClientIp", () => {
  test("x-real-ip를 우선한다 (프록시가 덮어쓰는 값)", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    assert.equal(getClientIp(req), "5.6.7.8");
  });

  test("x-real-ip가 없으면 x-forwarded-for의 마지막 값 (첫 값은 위조 가능)", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    assert.equal(getClientIp(req), "10.0.0.1");
  });

  test("헤더 객체도 받는다, 아무것도 없으면 unknown", () => {
    assert.equal(getClientIp(new Headers({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
    assert.equal(getClientIp(new Request("http://x")), "unknown");
  });
});
