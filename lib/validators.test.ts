import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  usernameSchema,
  phoneSchema,
  emailSchema,
  registerSchema,
  loginSchema,
  passwordPolicyError,
} from "./validators";

describe("usernameSchema", () => {
  test("소문자·숫자·밑줄 4~20자 통과", () => {
    assert.equal(usernameSchema.parse("abcd"), "abcd");
    assert.equal(usernameSchema.parse("user_01"), "user_01");
    assert.equal(usernameSchema.parse("a".repeat(20)), "a".repeat(20));
  });

  test("대문자·공백은 정규화된다", () => {
    assert.equal(usernameSchema.parse("  Abc1 "), "abc1");
  });

  test("숫자로 시작하면 거부", () => {
    assert.equal(usernameSchema.safeParse("1abc").success, false);
  });

  test("3자는 거부", () => {
    assert.equal(usernameSchema.safeParse("abc").success, false);
  });

  test("21자는 거부", () => {
    assert.equal(usernameSchema.safeParse("a".repeat(21)).success, false);
  });

  test("한글·특수문자 거부", () => {
    assert.equal(usernameSchema.safeParse("아이디123").success, false);
    assert.equal(usernameSchema.safeParse("abc-def").success, false);
  });

  test("예약어 거부", () => {
    for (const reserved of ["admin", "root", "system", "withdrawn"]) {
      assert.equal(usernameSchema.safeParse(reserved).success, false, reserved);
    }
  });
});

describe("phoneSchema", () => {
  test("하이픈 입력을 숫자로 정규화", () => {
    assert.equal(phoneSchema.parse("010-1234-5678"), "01012345678");
  });

  test("형식 오류는 메시지와 함께 거부", () => {
    const result = phoneSchema.safeParse("02-123-4567");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /010으로 시작하는 11자리/);
    }
  });
});

describe("emailSchema", () => {
  test("공백·대문자를 정규화", () => {
    assert.equal(emailSchema.parse("  Hong@Example.COM "), "hong@example.com");
  });

  test("형식 오류는 거부", () => {
    for (const bad of ["", "hong", "hong@", "@example.com", "hong@example"]) {
      assert.equal(emailSchema.safeParse(bad).success, false, bad);
    }
  });
});

const validRegister = {
  username: "Hong_gd",
  name: "홍길동",
  email: "Hong@Example.com",
  phone: "010-1234-5678",
  password: "safePass12",
  code: "123456",
  agreeTerms: true,
  agreePrivacy: true,
};

describe("registerSchema", () => {
  test("정상 입력 파싱", () => {
    const parsed = registerSchema.parse(validRegister);
    assert.deepEqual(parsed, {
      username: "hong_gd",
      name: "홍길동",
      email: "hong@example.com",
      phone: "01012345678",
      password: "safePass12",
      code: "123456",
      agreeTerms: true,
      agreePrivacy: true,
    });
  });

  test("이메일이 없으면 거부", () => {
    assert.equal(registerSchema.safeParse({ ...validRegister, email: undefined }).success, false);
  });

  test("코드가 6자리 숫자가 아니면 거부", () => {
    assert.equal(registerSchema.safeParse({ ...validRegister, code: "12ab" }).success, false);
  });

  test("약관·개인정보 동의가 없으면 거부", () => {
    assert.equal(registerSchema.safeParse({ ...validRegister, agreeTerms: false }).success, false);
    const result = registerSchema.safeParse({ ...validRegister, agreePrivacy: false });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.issues[0].message, /개인정보/);
  });

  test("비밀번호에 아이디가 들어가면 거부", () => {
    const result = registerSchema.safeParse({ ...validRegister, password: "hong_gd!234" });
    assert.equal(result.success, false);
  });
});

describe("passwordPolicyError", () => {
  test("3종류 조합 8자 이상 통과", () => {
    assert.equal(passwordPolicyError("abc123!@"), null);
    assert.equal(passwordPolicyError("Abcdef12"), null);
  });

  test("2종류 조합은 10자 이상이어야 통과", () => {
    assert.notEqual(passwordPolicyError("abcdef123"), null);
    assert.equal(passwordPolicyError("abcdef1234"), null);
  });

  test("1종류만 쓰거나 8자 미만이면 거부", () => {
    assert.notEqual(passwordPolicyError("abcdefghijkl"), null);
    assert.notEqual(passwordPolicyError("Ab1!"), null);
  });

  test("같은 문자 4번 연속·아이디 포함은 거부", () => {
    assert.notEqual(passwordPolicyError("aaaa1234!!"), null);
    assert.notEqual(passwordPolicyError("optixdev1234!", "optixdev1234"), null);
  });

  test("72바이트 초과는 거부", () => {
    assert.notEqual(passwordPolicyError(`Ab1!${"x".repeat(80)}`), null);
  });
});

describe("loginSchema", () => {
  test("아이디를 소문자로 정규화, otp는 없으면 undefined", () => {
    const parsed = loginSchema.parse({ username: " Admin ", password: "x" });
    assert.equal(parsed.username, "admin");
    assert.equal(parsed.password, "x");
    assert.equal(parsed.otp, undefined);
  });

  test("otp는 6자리 숫자만, 빈 값·'undefined' 문자열은 없음으로 본다", () => {
    assert.equal(loginSchema.parse({ username: "a", password: "x", otp: " 123456 " }).otp, "123456");
    assert.equal(loginSchema.parse({ username: "a", password: "x", otp: "" }).otp, undefined);
    assert.equal(loginSchema.parse({ username: "a", password: "x", otp: "undefined" }).otp, undefined);
    assert.equal(loginSchema.safeParse({ username: "a", password: "x", otp: "12ab56" }).success, false);
  });
});
