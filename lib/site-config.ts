/**
 * 사이트 공통 사업자 정보·판매 조건.
 * 전자상거래법상 필수 표시 항목을 한곳에서 관리한다.
 * 비어 있는 값은 화면에 표시되지 않으므로, 확보되는 대로 채워 넣을 것.
 */
export const SITE_INFO = {
  companyName: "Optix",
  companyNameEn: "Optix",
  ceo: "강석인",
  businessNumber: "450-39-01354",
  /** 통신판매업 신고번호 — 관할 구청 신고 후 기재 (예: "2026-전주완산-0000") */
  mailOrderNumber: "",
  address:
    "전북특별자치도 전주시 완산구 밤나부2길 4, 1층(효자동 1가)",
  email: "contact@goodautosystems.com",
  /** 고객센터 전화번호 — 확보 후 기재 (예: "063-000-0000") */
  phone: "",
  supportHours: "평일 09:00 - 18:00 (주말·공휴일 휴무)",
  privacyOfficer: "강석인 (대표)",
  hostingProvider: "자체 서버 운영",
} as const;

/** 데스크톱 프로그램 현재 배포 버전 — 설치 파일 교체 시 함께 갱신 */
export const PROGRAM_VERSION = {
  version: "1.0.0",
  releasedAt: "2026-08",
} as const;

/** 가격 표기 공통 문구 */
export const PRICE_NOTE = "부가세(VAT) 포함";
