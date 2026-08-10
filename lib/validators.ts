import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다."),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
