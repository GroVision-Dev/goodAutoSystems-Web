/**
 * SOLAPI 발송 점검 스크립트.
 *   npm run sms:test -- 01012345678
 * .env의 SOLAPI_* 값으로 테스트 문자 1건을 보낸다.
 * lib/sms.ts와 동일한 인증 방식이므로, 여기서 성공하면 회원가입 인증 문자도 발송된다.
 */
import { createHmac, randomBytes } from "node:crypto";

const to = (process.argv[2] ?? "").replace(/\D/g, "");
if (!/^010\d{8}$/.test(to)) {
  console.error("사용법: npm run sms:test -- 01012345678");
  process.exit(1);
}

const { SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER } = process.env;
const sender = (SOLAPI_SENDER ?? "").replace(/\D/g, "");

if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !sender) {
  console.error(
    "SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER가 설정되지 않았습니다. .env를 채워 주세요.\n" +
      "현재 상태에서는 회원가입 인증번호가 문자로 발송되지 않고 서버 콘솔에만 출력됩니다."
  );
  process.exit(1);
}

const date = new Date().toISOString();
const salt = randomBytes(16).toString("hex");
const signature = createHmac("sha256", SOLAPI_API_SECRET).update(date + salt).digest("hex");

console.log(`SOLAPI 발송 시도... from=${sender} to=${to}`);
const res = await fetch("https://api.solapi.com/messages/v4/send", {
  method: "POST",
  headers: {
    Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: {
      to,
      from: sender,
      text: `[Optix] SOLAPI 발송 테스트 ${new Date().toLocaleString("ko-KR")}`,
    },
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`✖ 발송 실패 (HTTP ${res.status}): ${body}`);
  console.error(
    "  - API 키/시크릿 확인\n  - 발신번호가 SOLAPI 콘솔에 등록·승인됐는지 확인\n  - 잔액 확인"
  );
  process.exit(1);
}
console.log(`✔ 발송 성공 → ${to}`);
console.log(`  응답: ${body}`);
