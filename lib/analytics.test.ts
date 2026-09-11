import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  maskIp,
  isBotUserAgent,
  shouldTrackPath,
  normalizePath,
  toKstDateKey,
  kstDayRange,
  shortVisitorId,
  truncateUserAgent,
} from "./analytics";

describe("maskIp", () => {
  test("IPv4는 뒤 두 옥텟을 가린다", () => {
    assert.equal(maskIp("211.234.56.78"), "211.234.xx.xx");
  });
  test("IPv6는 앞 세 그룹만 남긴다", () => {
    assert.equal(maskIp("2001:db8:85a3:0:0:8a2e:370:7334"), "2001:db8:85a3:xxxx");
  });
  test("x-forwarded-for 목록이면 첫 IP를 쓴다", () => {
    assert.equal(maskIp("10.0.0.1, 211.234.56.78"), "10.0.xx.xx");
  });
  test("IPv4-mapped IPv6(::ffff:)는 IPv4로 취급한다", () => {
    assert.equal(maskIp("::ffff:127.0.0.1"), "127.0.xx.xx");
  });
  test("비어 있거나 알 수 없는 형식이면 null", () => {
    assert.equal(maskIp(null), null);
    assert.equal(maskIp(""), null);
    assert.equal(maskIp("not-an-ip"), null);
  });
});

describe("isBotUserAgent", () => {
  test("대표적인 크롤러를 봇으로 판별한다", () => {
    assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0)"), true);
    assert.equal(isBotUserAgent("Yeti/1.1 (Naver Corp.)"), true);
    assert.equal(isBotUserAgent("curl/8.4.0"), true);
    assert.equal(isBotUserAgent("HeadlessChrome/120.0"), true);
  });
  test("일반 브라우저는 봇이 아니다", () => {
    assert.equal(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
      false,
    );
  });
  test("UA가 없으면 봇으로 본다", () => {
    assert.equal(isBotUserAgent(null), true);
    assert.equal(isBotUserAgent(""), true);
  });
});

describe("shouldTrackPath", () => {
  test("관리자·API·Next 내부 경로는 제외한다", () => {
    assert.equal(shouldTrackPath("/optix-dev"), false);
    assert.equal(shouldTrackPath("/optix-dev/users"), false);
    assert.equal(shouldTrackPath("/api/track"), false);
    assert.equal(shouldTrackPath("/_next/static/x.js"), false);
    assert.equal(shouldTrackPath("/favicon.ico"), false);
  });
  test("일반 페이지는 기록한다", () => {
    assert.equal(shouldTrackPath("/"), true);
    assert.equal(shouldTrackPath("/products/goodauto-pro"), true);
    assert.equal(shouldTrackPath("/mypage"), true);
  });
  test("슬래시로 시작하지 않는 값은 거부한다", () => {
    assert.equal(shouldTrackPath("products"), false);
    assert.equal(shouldTrackPath("https://evil.com/"), false);
  });
});

describe("normalizePath", () => {
  test("쿼리·해시를 제거하고 200자로 자른다", () => {
    assert.equal(normalizePath("/products?x=1#top"), "/products");
    assert.equal(normalizePath("/" + "a".repeat(300)).length, 200);
  });
  test("끝 슬래시를 정리한다 (루트 제외)", () => {
    assert.equal(normalizePath("/products/"), "/products");
    assert.equal(normalizePath("/"), "/");
  });
});

describe("KST 일자 처리", () => {
  test("UTC 시각을 한국 날짜 키로 바꾼다", () => {
    // 2026-09-10 16:30 UTC = 2026-09-11 01:30 KST
    assert.equal(toKstDateKey(new Date("2026-09-10T16:30:00Z")), "2026-09-11");
    assert.equal(toKstDateKey(new Date("2026-09-10T14:59:59Z")), "2026-09-10");
  });
  test("날짜 키의 하루 범위를 UTC 경계로 돌려준다", () => {
    const { start, end } = kstDayRange("2026-09-11");
    assert.equal(start.toISOString(), "2026-09-10T15:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-11T15:00:00.000Z");
  });
  test("잘못된 날짜 키는 예외", () => {
    assert.throws(() => kstDayRange("2026-13-40"));
    assert.throws(() => kstDayRange("abc"));
  });
});

describe("표시용 축약", () => {
  test("shortVisitorId는 앞 8자만 보여준다", () => {
    assert.equal(shortVisitorId("abcdefghijklmnop"), "abcdefgh");
  });
  test("truncateUserAgent는 255자로 자른다", () => {
    assert.equal(truncateUserAgent("x".repeat(400))?.length, 255);
    assert.equal(truncateUserAgent(null), null);
  });
});
