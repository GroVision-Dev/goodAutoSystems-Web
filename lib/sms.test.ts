import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildSolapiAuthHeader,
  sendSms,
  sendVerificationSms,
  verificationSmsText,
  getSmsConfig,
  SmsSendError,
} from "./sms";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function mockFetch(status: number, body: unknown = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return calls;
}

function setSolapiEnv() {
  process.env.SOLAPI_API_KEY = "KEY123";
  process.env.SOLAPI_API_SECRET = "SECRET456";
  process.env.SOLAPI_SENDER = "010-9999-8888";
}

beforeEach(() => {
  delete process.env.SOLAPI_API_KEY;
  delete process.env.SOLAPI_API_SECRET;
  delete process.env.SOLAPI_SENDER;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("buildSolapiAuthHeader", () => {
  test("HMAC-SHA256(secret, date + salt) hex 서명을 포함한다", () => {
    const date = "2026-09-07T00:00:00.000Z";
    const salt = "abcdef0123456789abcdef0123456789";
    const expected = createHmac("sha256", "SECRET456").update(date + salt).digest("hex");
    assert.equal(
      buildSolapiAuthHeader("KEY123", "SECRET456", date, salt),
      `HMAC-SHA256 apiKey=KEY123, date=${date}, salt=${salt}, signature=${expected}`
    );
  });

  test("date/salt 미지정 시 ISO 날짜와 32자 hex salt를 생성한다", () => {
    const header = buildSolapiAuthHeader("KEY123", "SECRET456");
    assert.match(
      header,
      /^HMAC-SHA256 apiKey=KEY123, date=\d{4}-\d{2}-\d{2}T[^,]+, salt=[0-9a-f]{32}, signature=[0-9a-f]{64}$/
    );
  });
});

describe("getSmsConfig", () => {
  test("환경변수가 하나라도 없으면 null", () => {
    process.env.SOLAPI_API_KEY = "k";
    process.env.SOLAPI_API_SECRET = "s";
    assert.equal(getSmsConfig(), null);
  });

  test("발신번호는 숫자만 남긴다", () => {
    setSolapiEnv();
    assert.deepEqual(getSmsConfig(), {
      apiKey: "KEY123",
      apiSecret: "SECRET456",
      sender: "01099998888",
    });
  });
});

describe("sendSms", () => {
  test("SOLAPI 단건 발송 API를 호출한다", async () => {
    setSolapiEnv();
    const calls = mockFetch(200, { groupId: "G1" });
    await sendSms("01012345678", "hello");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.solapi.com/messages/v4/send");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.match(headers.Authorization, /^HMAC-SHA256 apiKey=KEY123, /);
    assert.equal(headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      message: { to: "01012345678", from: "01099998888", text: "hello" },
    });
  });

  test("2xx가 아니면 SmsSendError", async () => {
    setSolapiEnv();
    mockFetch(400, { errorCode: "ValidationError", errorMessage: "bad" });
    await assert.rejects(sendSms("01012345678", "hello"), (e: unknown) => {
      assert.ok(e instanceof SmsSendError);
      assert.equal(e.status, 400);
      assert.match(e.body, /ValidationError/);
      return true;
    });
  });

  test("설정이 없으면 호출 전에 에러", async () => {
    const calls = mockFetch(200);
    await assert.rejects(sendSms("01012345678", "hello"), /SOLAPI 설정/);
    assert.equal(calls.length, 0);
  });
});

describe("sendVerificationSms", () => {
  test("본문에 코드와 유효시간이 들어간다", () => {
    assert.equal(verificationSmsText("123456"), "[Optix] 회원가입 인증번호 123456 (10분 유효)");
  });

  test("개발 모드(설정 없음)에서는 fetch를 호출하지 않는다", async () => {
    const calls = mockFetch(200);
    await sendVerificationSms("01012345678", "123456");
    assert.equal(calls.length, 0);
  });

  test("설정이 있으면 인증번호 문자를 보낸다", async () => {
    setSolapiEnv();
    const calls = mockFetch(200);
    await sendVerificationSms("01012345678", "123456");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.message.to, "01012345678");
    assert.equal(body.message.text, "[Optix] 회원가입 인증번호 123456 (10분 유효)");
  });
});
