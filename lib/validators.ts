import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;
export const RESERVED_USERNAMES = ["admin", "root", "system", "withdrawn", "optixdev1234"];
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

export const EMAIL_RULE_MESSAGE = "올바른 이메일 주소를 입력해 주세요.";

/** 앞뒤 공백 제거·소문자 정규화. 결제사(PG) 구매자 정보와 영수증 발송에 사용 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email(EMAIL_RULE_MESSAGE)
  .max(254, EMAIL_RULE_MESSAGE);

/**
 * 비밀번호 정책 (KISA 권고 기준)
 * 영문 대문자·소문자·숫자·특수문자 중 2종류 이상 조합 10자 이상, 또는 3종류 이상 조합 8자 이상.
 * bcrypt는 72바이트까지만 비교하므로 그 이상은 거부한다.
 */
export const PASSWORD_RULE_MESSAGE =
  "영문 대·소문자, 숫자, 특수문자 중 2종류 이상 조합 10자 이상 또는 3종류 이상 조합 8자 이상으로 입력해 주세요.";
export const PASSWORD_PLACEHOLDER = "비밀번호 (2종류 조합 10자 / 3종류 조합 8자 이상)";
const PASSWORD_MAX_BYTES = 72;

/** 정책 위반 사유를 돌려준다. 통과하면 null */
export function passwordPolicyError(password: string, username?: string): string | null {
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "비밀번호가 너무 깁니다. (영문 기준 72자 이내)";
  }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const strongEnough = kinds >= 3 || (kinds >= 2 && password.length >= 10);
  if (!strongEnough) return PASSWORD_RULE_MESSAGE;
  if (/(.)\1{3,}/.test(password)) return "같은 문자를 4번 이상 연속으로 사용할 수 없습니다.";
  if (username && username.length >= 4 && password.toLowerCase().includes(username.toLowerCase())) {
    return "비밀번호에 아이디를 포함할 수 없습니다.";
  }
  return null;
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const error = passwordPolicyError(value);
  if (error) ctx.addIssue({ code: "custom", message: error });
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(40, "이름은 40자 이내로 입력해 주세요."),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    code: z.string().regex(/^\d{6}$/, "인증코드 6자리를 입력해 주세요."),
    agreeTerms: z.boolean().refine((v) => v === true, "이용약관에 동의해 주세요."),
    agreePrivacy: z.boolean().refine((v) => v === true, "개인정보 수집·이용에 동의해 주세요."),
  })
  .superRefine((value, ctx) => {
    const error = passwordPolicyError(value.password, value.username);
    if (error) ctx.addIssue({ code: "custom", path: ["password"], message: error });
  });

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(50),
  password: z.string().min(1).max(200),
  /** 관리자 2단계 인증 문자 코드 (1단계 요청에는 없음) */
  otp: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" && v !== "undefined" ? v.trim() : undefined),
    z.string().regex(/^\d{6}$/).optional()
  ),
});
