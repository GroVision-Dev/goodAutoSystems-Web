import type { Metadata } from "next";
import { SITE_INFO } from "@/lib/site-config";

export const metadata: Metadata = { title: "개인정보처리방침" };

interface Section {
  title: string;
  /** 문단 */
  paragraphs?: string[];
  /** 항목 목록 (구분: 내용) */
  items?: { label: string; value: string }[];
}

/**
 * 실제 처리 현황과 일치해야 한다.
 * 보유 기간을 바꾸면 lib/retention.ts(자동 파기)도 함께 바꿀 것.
 */
const SECTIONS: Section[] = [
  {
    title: "1. 수집하는 개인정보 항목",
    items: [
      {
        label: "회원가입 (필수)",
        value:
          "아이디, 이름, 이메일, 휴대폰 번호, 비밀번호(복호화할 수 없는 일방향 암호화(bcrypt)로 저장), 이용약관·개인정보 수집 동의 일시",
      },
      {
        label: "도입 문의 (필수)",
        value: "이름, 휴대폰 번호, 문의 내용",
      },
      {
        label: "도입 문의 (선택)",
        value: "이메일, 회사명, 관심 상품",
      },
      {
        label: "비회원 결제 요청",
        value: "받는 분 이름·휴대폰 번호(담당자 입력), 결제 시 입력한 이메일, 결제 요청 항목·금액",
      },
      {
        label: "결제",
        value:
          "결제는 결제대행사 포트원(PortOne)과 연동 PG사가 처리하며, 회사는 카드번호 등 결제수단 정보를 저장하지 않습니다. 회사는 주문번호, 결제 금액, 결제 일시, 결제수단 종류만 보관합니다.",
      },
      {
        label: "서비스 이용 시 자동 수집",
        value:
          "접속 일시, 조회한 페이지, 브라우저·기기 정보, 일부가 가려진(마스킹된) IP 주소, 방문자 구분용 쿠키 식별값(optix_vid, 1년)",
      },
      {
        label: "보안 목적 접속기록",
        value:
          "로그인 일시·결과, IP 주소, 브라우저 정보, 관리자의 개인정보 열람·처리 기록",
      },
    ],
  },
  {
    title: "2. 개인정보의 수집 및 이용 목적",
    items: [
      { label: "회원 관리", value: "본인 확인, 로그인, 부정 이용 방지, 프로그램 사용권 확인" },
      { label: "상품 판매", value: "주문·결제 처리, 구매 상품 다운로드 제공, 월 이용료 청구서 안내" },
      { label: "비회원 결제", value: "결제 요청 문자 안내, 결제 처리, 결제 내역 확인·환불" },
      { label: "고객 응대", value: "도입 문의 답변·상담, 불만 처리" },
      { label: "보안·서비스 개선", value: "비정상 접근 탐지, 접속기록 점검, 이용 통계 분석" },
    ],
  },
  {
    title: "3. 개인정보의 보유 및 이용 기간",
    paragraphs: [
      "회사는 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 아래 항목은 명시한 기간 동안 보관합니다.",
    ],
    items: [
      {
        label: "회원 정보",
        value:
          "회원 탈퇴 시 즉시 익명화·파기합니다. 단, 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약 또는 청약철회 등에 관한 기록 5년, 대금결제 및 재화 등의 공급에 관한 기록 5년, 소비자의 불만 또는 분쟁처리에 관한 기록 3년간 보관합니다.",
      },
      {
        label: "비회원 결제 요청",
        value: "전자상거래 등에서의 소비자보호에 관한 법률에 따른 대금결제 및 재화 등의 공급에 관한 기록으로 5년 보관",
      },
      { label: "도입 문의", value: "처리 완료 후 1년" },
      { label: "접속 통계", value: "수집일로부터 1년" },
      {
        label: "보안 접속기록",
        value: "2년 보관 후 파기 (개인정보의 안전성 확보조치 기준에 따른 최소 보관기간 1년 이상)",
      },
      { label: "휴대폰·로그인 인증번호", value: "인증 완료 즉시 삭제, 미사용 시 만료 후 삭제" },
      { label: "로그인 세션 정보", value: "세션 만료 또는 로그아웃 후 30일" },
    ],
  },
  {
    title: "4. 개인정보의 제3자 제공",
    paragraphs: [
      "회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 이용자가 사전에 동의한 경우나 법령에 특별한 규정이 있는 경우(수사기관의 적법한 요청 등)에는 예외로 합니다.",
    ],
  },
  {
    title: "5. 개인정보 처리의 위탁",
    paragraphs: ["회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다."],
    items: [
      {
        label: "포트원(PortOne) 및 연동 PG사",
        value:
          "결제 처리 및 결제 취소(환불) — 주문번호, 상품명, 결제 금액, 구매자 이름·휴대폰 번호·이메일",
      },
      {
        label: "솔라피(SOLAPI, (주)누리고)",
        value: "문자 발송(회원가입 인증번호, 관리자 로그인 인증번호, 청구서·단건 결제 요청 안내) — 휴대폰 번호, 문자 내용",
      },
    ],
  },
  {
    title: "6. 쿠키의 사용",
    items: [
      { label: "로그인 세션 쿠키", value: "로그인 유지 목적. 최대 3일(관리자 8시간) 후 만료되며 로그아웃 시 즉시 무효화" },
      { label: "방문자 통계 쿠키(optix_vid)", value: "방문자 구분·이용 통계 목적, 1년 보관" },
      {
        label: "거부 방법",
        value:
          "브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다. 다만 쿠키를 거부하면 로그인이 필요한 서비스(구매, 마이페이지 등) 이용이 제한됩니다.",
      },
    ],
  },
  {
    title: "7. 개인정보의 안전성 확보조치",
    items: [
      { label: "관리적 조치", value: "개인정보 취급 관리자 최소화, 관리자 접속기록 보관 및 정기 점검" },
      {
        label: "기술적 조치",
        value:
          "비밀번호 일방향 암호화, HTTPS(TLS) 전송구간 암호화, 관리자 로그인 문자 2단계 인증, 반복 로그인 실패 시 계정 잠금, 데이터베이스 외부 접근 차단, 백업 파일 암호화 보관",
      },
    ],
  },
  {
    title: "8. 개인정보의 파기 절차 및 방법",
    paragraphs: [
      "보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 자동 파기 작업을 통해 지체 없이 파기합니다. 법령에 따라 보관해야 하는 정보는 별도로 분리해 보관 기간 동안만 보관합니다.",
      "전자적 파일 형태의 정보는 복구·재생할 수 없는 방법으로 영구 삭제하며, 출력물 등 종이 문서는 분쇄하거나 소각합니다.",
    ],
  },
  {
    title: "9. 이용자의 권리와 행사 방법",
    paragraphs: [
      "이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다. 회원 정보는 마이페이지에서 직접 조회·수정할 수 있고, 회원 탈퇴를 통해 개인정보 수집·이용 동의를 철회할 수 있습니다.",
      `그 밖의 요청은 이메일(${SITE_INFO.email})로 접수하시면 지체 없이 조치하겠습니다.`,
    ],
  },
  {
    title: "10. 개인정보 보호책임자",
    items: [
      { label: "개인정보 보호책임자", value: SITE_INFO.privacyOfficer },
      { label: "연락처", value: `${SITE_INFO.email} · ${SITE_INFO.phone}` },
    ],
    paragraphs: ["개인정보 관련 문의·불만·피해구제 요청에 대해 신속하고 성실하게 답변해 드립니다."],
  },
  {
    title: "11. 권익침해 구제 방법",
    paragraphs: ["개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의하실 수 있습니다."],
    items: [
      { label: "개인정보분쟁조정위원회", value: "1833-6972 (www.kopico.go.kr)" },
      { label: "개인정보침해신고센터", value: "118 (privacy.kisa.or.kr)" },
      { label: "대검찰청 사이버수사과", value: "1301 (www.spo.go.kr)" },
      { label: "경찰청 사이버수사국", value: "182 (ecrm.police.go.kr)" },
    ],
  },
  {
    title: "12. 고지의 의무",
    paragraphs: [
      "본 방침의 내용 추가, 삭제 및 수정이 있을 경우 시행 7일 전부터 웹사이트를 통해 고지합니다.",
      "본 방침은 2026년 9월 21일부터 시행하며, 이전 방침(2026년 8월 5일 시행)을 대체합니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Optix(이하 &ldquo;회사&rdquo;)는 개인정보보호법 등 관련 법령을
        준수하며, 이용자의 개인정보를 소중히 보호합니다.
      </p>
      <div className="mt-10 flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-bold">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <dl className="mt-3 flex flex-col divide-y divide-line/60 rounded-xl border border-line text-sm">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4"
                  >
                    <dt className="shrink-0 font-medium sm:w-44">{item.label}</dt>
                    <dd className="break-keep leading-relaxed text-muted">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
