/**
 * 상품 상세페이지 리치 콘텐츠.
 * DB Product(가격·판매 정보)와 분리해 코드에서 관리한다.
 * 여기 등록되지 않은 슬러그(어드민에서 새로 만든 상품)는 기본 레이아웃으로 표시된다.
 */

export interface ProductMetric {
  value: string;
  label: string;
}

export interface ProductFeature {
  icon: string;
  title: string;
  description: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface TimelineStep {
  period: string;
  title: string;
  description: string;
}

export interface ProductFaq {
  q: string;
  a: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

export interface ProductContent {
  /** 상단 요약 지표 */
  metrics: ProductMetric[];
  /** 실행 화면 */
  gallery: GalleryImage[];
  /** 주요 기능 */
  features: ProductFeature[];
  /** 스펙 표 (프로그램: 시스템 요구사항 / 서비스: 포함 내역) */
  specsTitle: string;
  specs: SpecRow[];
  /** 진행 일정 (서비스 상품만) */
  timeline?: TimelineStep[];
  /** 상품별 FAQ */
  faqs: ProductFaq[];
}

export const PRODUCT_CONTENT: Record<string, ProductContent> = {
  "goodauto-pro": {
    metrics: [
      { value: "12배", label: "수작업 대비 처리 속도" },
      { value: "99.9%", label: "시나리오 실행 성공률" },
      { value: "24시간", label: "스케줄 기반 무인 실행" },
    ],
    gallery: [
      {
        src: "/images/goodauto-pro-ui.svg",
        alt: "GoodAuto Pro 시나리오 편집기 실행 화면",
        caption: "시나리오 편집기 — 실행 단계와 실시간 로그를 한 화면에서",
      },
      {
        src: "/images/workflow-diagram.svg",
        alt: "GoodAuto Pro 자동화 파이프라인",
        caption: "수집부터 보고까지, 사람 손을 거치지 않는 실행 흐름",
      },
    ],
    features: [
      {
        icon: "🧩",
        title: "코딩 없는 시나리오 편집기",
        description:
          "클릭·입력·조건 분기를 블록처럼 조립합니다. 개발 지식 없이 현업 담당자가 직접 자동화를 만듭니다.",
      },
      {
        icon: "⏰",
        title: "스케줄러",
        description:
          "매일 아침 8시, 매주 월요일 등 지정한 시간에 자동 실행됩니다. 실패 시 재시도 횟수도 설정할 수 있습니다.",
      },
      {
        icon: "📊",
        title: "엑셀·CSV 데이터 연동",
        description:
          "엑셀 파일을 읽어 반복 입력하고, 수집한 데이터를 정해진 양식으로 저장합니다.",
      },
      {
        icon: "🌐",
        title: "웹사이트 자동화",
        description:
          "로그인, 게시물 등록, 데이터 다운로드 등 브라우저에서 하던 반복 작업을 대신합니다.",
      },
      {
        icon: "📋",
        title: "실행 로그·오류 알림",
        description:
          "모든 실행 내역이 기록되고, 오류 발생 시 즉시 알림을 받아 바로 대응할 수 있습니다.",
      },
      {
        icon: "🔐",
        title: "계정 기반 라이선스",
        description:
          "홈페이지 계정으로 로그인하면 즉시 인증됩니다. 별도 시리얼 키 관리가 필요 없습니다.",
      },
    ],
    specsTitle: "시스템 요구사항 및 라이선스",
    specs: [
      { label: "지원 OS", value: "Windows 10 / 11 (64bit)" },
      { label: "메모리", value: "4GB 이상 권장" },
      { label: "디스크 공간", value: "500MB 이상" },
      { label: "필요 환경", value: "인터넷 연결 (계정 인증)" },
      { label: "라이선스", value: "계정당 PC 1대 사용 (추가 필요 시 문의)" },
      { label: "업데이트", value: "기능·보안 업데이트 무상 제공" },
      { label: "기술 지원", value: "이메일 지원 · 평일 09:00 - 18:00" },
    ],
    faqs: [
      {
        q: "구매 후 바로 사용할 수 있나요?",
        a: "네. 결제 완료 즉시 마이페이지에서 설치 파일을 다운로드할 수 있고, 홈페이지 계정으로 프로그램에 로그인하면 바로 인증됩니다.",
      },
      {
        q: "컴퓨터를 바꾸면 다시 구매해야 하나요?",
        a: "아니요. 계정 기반 라이선스라 새 PC에 설치 후 같은 계정으로 로그인하면 됩니다. 동시 사용은 계정당 1대입니다.",
      },
      {
        q: "자동화를 만들다 막히면 도움을 받을 수 있나요?",
        a: "이메일로 시나리오 구성 관련 기술 지원을 제공합니다. 복잡한 업무는 AI 업무 자동화 서비스로 구축을 대행해 드릴 수도 있습니다.",
      },
      {
        q: "환불 규정은 어떻게 되나요?",
        a: "설치 파일 다운로드 또는 프로그램 로그인 이전이라면 결제일로부터 7일 이내 전액 환불됩니다. 자세한 내용은 이용약관을 확인해 주세요.",
      },
    ],
  },

  "ai-automation-starter": {
    metrics: [
      { value: "2~4주", label: "진단부터 구축 완료까지" },
      { value: "70%", label: "반복 문서 업무 시간 절감" },
      { value: "1개월", label: "구축 후 운영 지원" },
    ],
    gallery: [
      {
        src: "/images/ai-docs-dashboard.svg",
        alt: "AI 문서 자동 분류·요약 대시보드 화면",
        caption: "구축 후 제공되는 AI 문서 처리 대시보드 — 실시간 처리 현황",
      },
    ],
    features: [
      {
        icon: "🔍",
        title: "업무 프로세스 진단",
        description:
          "담당 컨설턴트가 현재 업무 흐름을 분석해 자동화 효과가 가장 큰 프로세스를 선정합니다.",
      },
      {
        icon: "📄",
        title: "AI 문서 분류·요약",
        description:
          "이메일·문서함에 들어오는 문서를 AI가 자동 분류하고 핵심만 요약해 전달합니다.",
      },
      {
        icon: "✍️",
        title: "이메일·보고서 자동 작성",
        description:
          "정기 보고서와 반복 회신 메일의 초안을 AI가 자동으로 생성합니다.",
      },
      {
        icon: "🤝",
        title: "1개월 운영 지원",
        description:
          "구축 후 1개월간 오류 대응과 정확도 개선을 지원해 안정적으로 정착시킵니다.",
      },
    ],
    specsTitle: "포함 내역",
    specs: [
      { label: "대상", value: "소규모 팀 (1개 업무 프로세스)" },
      { label: "진단", value: "업무 프로세스 분석 및 자동화 설계 1회" },
      { label: "구축", value: "AI 문서 분류·요약 + 이메일·보고서 자동 작성 워크플로" },
      { label: "교육", value: "담당자 사용 교육 1회" },
      { label: "운영 지원", value: "구축 완료 후 1개월" },
      { label: "결과물", value: "자동화 워크스페이스 + 운영 가이드 문서" },
    ],
    timeline: [
      {
        period: "1주차",
        title: "업무 진단·설계",
        description: "업무 인터뷰, 자동화 구간 선정, 목표 지표 합의",
      },
      {
        period: "2~3주차",
        title: "구축·검증",
        description: "실제 업무 데이터로 AI 워크플로 구축 및 정확도 검증",
      },
      {
        period: "4주차",
        title: "검수·교육",
        description: "담당자 검수, 사용 교육, 운영 가이드 전달",
      },
      {
        period: "+1개월",
        title: "운영 지원",
        description: "오류 대응, 예외 케이스 보완, 정확도 개선",
      },
    ],
    faqs: [
      {
        q: "우리 회사 업무에 적용 가능한지 어떻게 확인하나요?",
        a: "결제 전 도입 문의를 남겨주시면 업무 내용을 확인하고 적용 가능 여부와 예상 효과를 무료로 안내해 드립니다. 결제 후 진단 단계에서 상세 범위를 확정합니다.",
      },
      {
        q: "사내 데이터가 외부로 나가지 않나요?",
        a: "처리 데이터의 저장 위치와 접근 권한은 구축 시 회사 정책에 맞춰 설계합니다. 요청 시 데이터 처리 범위를 계약서에 명시합니다.",
      },
      {
        q: "구축 후 월 이용료가 있나요?",
        a: "스타터 패키지 자체는 1회 결제입니다. AI 처리량에 따른 실비(API 비용 등)가 발생하는 구성이라면 진단 단계에서 예상 비용을 미리 안내해 드립니다.",
      },
      {
        q: "프로세스를 추가하고 싶으면 어떻게 하나요?",
        a: "프로세스 단위로 추가 견적을 드리며, 3개 부서 이상 확장 시에는 엔터프라이즈 상품이 더 경제적입니다.",
      },
    ],
  },

  "ai-automation-enterprise": {
    metrics: [
      { value: "5개 부서", label: "맞춤 워크플로 구축 범위" },
      { value: "1,200시간+", label: "도입 기업 평균 연간 절감" },
      { value: "3개월", label: "전담 매니저 운영 지원" },
    ],
    gallery: [
      {
        src: "/images/ai-report-dashboard.svg",
        alt: "경영 보고서 자동 생성 대시보드 화면",
        caption: "경영 보고서 자동 생성 — 데이터 집계부터 리포트 발송까지",
      },
      {
        src: "/images/workflow-diagram.svg",
        alt: "전사 업무 자동화 파이프라인",
        caption: "부서별 업무가 하나의 자동화 파이프라인으로 연결됩니다",
      },
    ],
    features: [
      {
        icon: "🗺️",
        title: "전사 진단·로드맵",
        description:
          "회사 전체 업무 흐름을 진단하고 부서별 자동화 우선순위 로드맵을 수립합니다.",
      },
      {
        icon: "🏢",
        title: "부서별 맞춤 워크플로",
        description:
          "영업·회계·CS 등 최대 5개 부서에 각 업무 특성에 맞는 AI 워크플로를 구축합니다.",
      },
      {
        icon: "🔗",
        title: "ERP·그룹웨어 연동",
        description:
          "기존 사내 시스템과 직접 연동해 데이터 이중 입력 없이 업무가 흐르게 만듭니다.",
      },
      {
        icon: "👤",
        title: "전담 매니저",
        description:
          "프로젝트 전 기간 전담 매니저가 배정되어 일정·품질·변경 요청을 관리합니다.",
      },
      {
        icon: "🎓",
        title: "임직원 교육 2회",
        description:
          "구축된 시스템의 활용 교육을 2회 제공해 조직 전체의 활용도를 높입니다.",
      },
      {
        icon: "📈",
        title: "성과 리포트",
        description:
          "운영 기간 동안 월간 성과 리포트로 절감 시간과 개선 포인트를 보고합니다.",
      },
    ],
    specsTitle: "포함 내역",
    specs: [
      { label: "대상", value: "중소·중견 기업 (최대 5개 부서)" },
      { label: "진단", value: "전사 업무 프로세스 진단 및 자동화 로드맵 수립" },
      { label: "구축", value: "부서별 맞춤 AI 워크플로 + 사내 시스템(ERP/그룹웨어) 연동" },
      { label: "교육", value: "임직원 교육 2회" },
      { label: "운영 지원", value: "전담 매니저 배정 · 구축 완료 후 3개월" },
      { label: "결과물", value: "자동화 워크스페이스 + 운영 가이드 + 월간 성과 리포트" },
    ],
    timeline: [
      {
        period: "1~2주차",
        title: "전사 진단",
        description: "부서별 업무 인터뷰, 자동화 로드맵·우선순위 수립",
      },
      {
        period: "3~6주차",
        title: "부서별 구축",
        description: "우선순위에 따라 부서별 워크플로 구축, 시스템 연동",
      },
      {
        period: "7~8주차",
        title: "안정화·교육",
        description: "통합 검수, 임직원 교육, 운영 체계 이관",
      },
      {
        period: "+3개월",
        title: "운영 지원",
        description: "전담 매니저 운영 지원, 월간 성과 리포트, 확산 과제 발굴",
      },
    ],
    faqs: [
      {
        q: "기존 ERP를 바꿔야 하나요?",
        a: "아니요. 기존 시스템은 그대로 두고 자동화 레이어를 연동하는 방식이라 시스템 교체 없이 도입됩니다.",
      },
      {
        q: "부서가 5개보다 많으면 어떻게 하나요?",
        a: "기본 범위는 5개 부서이며, 초과 부서는 진단 결과를 바탕으로 추가 견적을 드립니다. 단계적 확산을 권장합니다.",
      },
      {
        q: "도입 기간 동안 현업 부담이 크지 않나요?",
        a: "부서별 인터뷰(회당 1시간 내외)와 검수 참여 정도입니다. 구축 작업은 전담 인력이 수행하므로 현업 업무 중단은 없습니다.",
      },
      {
        q: "계약·세금계산서 처리는 어떻게 되나요?",
        a: "온라인 결제 외에 계약서 기반 진행(선금/잔금)도 가능합니다. 세금계산서는 요청 시 발행해 드립니다. 도입 문의로 연락 주세요.",
      },
    ],
  },
};

/** AI 서비스 상품 비교표 (스타터·엔터프라이즈 상세페이지에 노출) */
export const AI_SERVICE_COMPARISON = {
  rows: [
    { label: "대상 규모", starter: "소규모 팀", enterprise: "중소·중견 기업" },
    { label: "자동화 범위", starter: "1개 업무 프로세스", enterprise: "최대 5개 부서" },
    { label: "사내 시스템 연동", starter: "—", enterprise: "ERP · 그룹웨어 연동" },
    { label: "전담 매니저", starter: "—", enterprise: "전 기간 배정" },
    { label: "교육", starter: "담당자 교육 1회", enterprise: "임직원 교육 2회" },
    { label: "운영 지원", starter: "1개월", enterprise: "3개월 + 월간 리포트" },
    { label: "구축 기간", starter: "2~4주", enterprise: "6~8주" },
  ],
};
