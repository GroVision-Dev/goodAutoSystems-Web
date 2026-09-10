import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  usernameSchema,
  phoneSchema,
  emailSchema,
  registerSchema,
  loginSchema,
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

describe("registerSchema", () => {
  test("정상 입력 파싱", () => {
    const parsed = registerSchema.parse({
      username: "Hong_gd",
      name: "홍길동",
      email: "Hong@Example.com",
      phone: "010-1234-5678",
      password: "password1",
      code: "123456",
    });
    assert.deepEqual(parsed, {
      username: "hong_gd",
      name: "홍길동",
      email: "hong@example.com",
      phone: "01012345678",
      password: "password1",
      code: "123456",
    });
  });

  test("이메일이 없으면 거부", () => {
    const result = registerSchema.safeParse({
      username: "hong",
      name: "홍길동",
      phone: "01012345678",
      password: "password1",
      code: "123456",
    });
    assert.equal(result.success, false);
  });

  test("코드가 6자리 숫자가 아니면 거부", () => {
    const result = registerSchema.safeParse({
      username: "hong",
      name: "홍길동",
      email: "hong@example.com",
      phone: "01012345678",
      password: "password1",
      code: "12ab",
    });
    assert.equal(result.success, false);
  });
});

describe("loginSchema", () => {
  test("아이디를 소문자로 정규화", () => {
    assert.deepEqual(loginSchema.parse({ username: " Admin ", password: "x" }), {
      username: "admin",
      password: "x",
    });
  });
});
