/**
 * 사이트 공통 사업자 정보·판매 조건.
 * 전자상거래법상 필수 표시 항목을 한곳에서 관리한다.
 * 비어 있는 값은 화면에 표시되지 않으므로, 확보되는 대로 채워 넣을 것.
 */
export const SITE_INFO = {
  /** 사업자등록증 상호 */
  companyName: "옵틱스(Optix)",
  companyNameEn: "Optix",
  ceo: "강석인",
  businessNumber: "450-39-01354",
  /** 과세유형 — 사업자등록증 기준 (전주세무서, 2026-09-04 최초발급) */
  taxType: "간이과세자",
  /** 개업연월일 */
  openedAt: "2026-09-03",
  /** 사업의 종류 — 업태 / 종목 (사업자등록증 기준) */
  businessTypes: [
    { category: "도매 및 소매업", item: "전자상거래 소매업" },
    { category: "정보통신업", item: "응용 소프트웨어 개발 및 공급업" },
    { category: "정보통신업", item: "기타 게임 소프트웨어 개발 및 공급업" },
  ],
  /** 통신판매업 신고번호 — 관할 구청 신고 후 기재 (예: "2026-전주완산-0000") */
  mailOrderNumber: "",
  address:
    "전북특별자치도 전주시 완산구 밤나무2길 4, 1층(효자동1가)",
  email: "contact@goodautosystems.com",
  phone: "010-2532-2314",
  supportHours: "평일 09:00 - 18:00 (주말·공휴일 휴무)",
  privacyOfficer: "강석인 (대표)",
  hostingProvider: "자체 서버 운영",
} as const;

/**
 * 간이과세자 안내 문구.
 * 간이과세자(신규 사업자)는 세금계산서를 발행할 수 없으므로,
 * 증빙은 카드 매출전표 또는 현금영수증(지출증빙용)으로 안내한다.
 */
export const TAX_NOTICE =
  "당사는 간이과세자로 세금계산서 발행이 불가하며, 카드 매출전표 또는 현금영수증(지출증빙용)으로 증빙하실 수 있습니다.";

/** 결제 증빙 안내 (결제·청구서 페이지 공통) */
export const RECEIPT_NOTE =
  "카드 매출전표 자동 발급 · 현금영수증(지출증빙용)은 결제 후 요청 가능 · 간이과세자로 세금계산서 발행 불가";

/** 데스크톱 프로그램 현재 배포 버전 — 설치 파일 교체 시 함께 갱신 */
export const PROGRAM_VERSION = {
  version: "1.0.0",
  releasedAt: "2026-08",
} as const;

/** 가격 표기 공통 문구 */
export const PRICE_NOTE = "부가세(VAT) 포함";
