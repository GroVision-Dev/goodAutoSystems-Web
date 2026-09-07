import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;
export const RESERVED_USERNAMES = ["admin", "root", "system", "withdrawn"];
export const USERNAME_RULE_MESSAGE =
  "아이디는 영문 소문자로 시작하는 영문 소문자·숫자·밑줄(_) 4~20자입니다.";
export const PHONE_RULE_MESSAGE =
  "올바른 휴대폰 번호가 아닙니다. (010으로 시작하는 11자리)";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, USERNAME_RULE_MESSAGE)
  .refine((v) => !RESERVED_USERNAMES.includes(v), "사용할 수 없는 아이디입니다.");

/** 하이픈·공백 포함 입력을 받아 숫자 11자리로 정규화한다 */
export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: PHONE_RULE_MESSAGE });
    return z.NEVER;
  }
  return normalized;
});

export const registerSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다."),
  phone: phoneSchema,
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  code: z.string().regex(/^\d{6}$/, "인증코드 6자리를 입력해 주세요."),
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
