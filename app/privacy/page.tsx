import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

const SECTIONS = [
  {
    title: "1. 수집하는 개인정보 항목",
    body: "회사는 회원가입 및 서비스 제공을 위해 다음의 개인정보를 수집합니다. 필수항목: 아이디, 이름, 이메일, 휴대폰 번호, 비밀번호(암호화 저장). 결제 시: 결제 정보는 토스페이먼츠(PG사)가 처리하며 회사는 카드번호 등 민감한 결제 정보를 저장하지 않습니다. 서비스 이용 과정에서 자동 생성되는 정보: 접속 일시, 조회한 페이지, 브라우저 정보, 일부가 가려진(마스킹된) IP 주소, 방문자 구분용 쿠키 식별값이 서비스 이용 통계 목적으로 수집됩니다.",
  },
  {
    title: "2. 개인정보의 수집 및 이용 목적",
    body: "회원 관리(본인 확인, 로그인, 프로그램 사용권 확인), 상품 판매 및 결제 처리, 구매 상품의 다운로드 제공, 고객 문의 대응, 서비스 개선을 위해 이용합니다.",
  },
  {
    title: "3. 개인정보의 보유 및 이용 기간",
    body: "회원 탈퇴 시 지체 없이 파기합니다. 다만 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약 또는 청약철회 등에 관한 기록은 5년, 대금결제 및 재화 등의 공급에 관한 기록은 5년, 소비자의 불만 또는 분쟁처리에 관한 기록은 3년간 보관합니다.",
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: "회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 결제 처리를 위해 토스페이먼츠에 결제에 필요한 최소한의 정보(주문번호, 상품명, 결제금액, 구매자 이름·휴대폰 번호·이메일)가 제공됩니다.",
  },
  {
    title: "5. 개인정보의 파기 절차 및 방법",
    body: "보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일 형태는 복구할 수 없는 방법으로 영구 삭제합니다.",
  },
  {
    title: "6. 이용자의 권리",
    body: "이용자는 언제든지 마이페이지에서 본인의 개인정보를 조회할 수 있으며, 이메일(contact@goodautosystems.com)을 통해 정정·삭제·처리정지를 요청할 수 있습니다.",
  },
  {
    title: "7. 개인정보 보호책임자",
    body: "개인정보 보호책임자 : 강석인 (대표) · 문의 : contact@goodautosystems.com. 개인정보 관련 문의사항에 대해 신속하고 성실하게 답변해 드립니다.",
  },
  {
    title: "8. 고지의 의무",
    body: "본 방침의 내용 추가, 삭제 및 수정이 있을 경우 시행 7일 전부터 웹사이트 공지사항을 통해 고지합니다. 본 방침은 2026년 8월 5일부터 시행합니다.",
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
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
