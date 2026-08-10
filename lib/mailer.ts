import nodemailer from "nodemailer";

/**
 * SMTP 설정이 없으면(로컬 개발) 메일 내용을 서버 콘솔에 출력한다.
 * 운영에서는 .env에 SMTP_HOST 등을 설정하면 실제 발송된다.
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true", // 465 포트면 true
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  const transport = getTransport();

  if (!transport) {
    console.log(
      `[mailer] SMTP 미설정 — 개발 모드. ${email} 인증코드: ${code} (10분 유효)`
    );
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "굿오토시스템즈 <no-reply@goodautosystems.com>",
    to: email,
    subject: `[굿오토시스템즈] 회원가입 인증코드 ${code}`,
    text: `굿오토시스템즈 회원가입 인증코드는 ${code} 입니다.\n10분 안에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.`,
    html: `
      <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0f1e;border-radius:16px;color:#e2e8f0">
        <p style="font-size:18px;font-weight:700;margin:0">굿오토시스템즈</p>
        <p style="margin:24px 0 8px;color:#94a3b8;font-size:14px">회원가입 인증코드</p>
        <p style="font-size:36px;font-weight:700;letter-spacing:8px;margin:0;color:#3b82f6">${code}</p>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.6">
          10분 안에 입력해 주세요.<br/>본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
        </p>
      </div>`,
  });
}
