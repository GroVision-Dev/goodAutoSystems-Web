import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 관리자 아이디. 추측하기 쉬운 "admin"은 사용하지 않는다.
const ADMIN_USERNAME = "optixdev1234";
const LEGACY_ADMIN_USERNAME = "admin";

async function main() {
  const adminPassword = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD || "optixdev1234",
    10
  );
  const userPassword = await bcrypt.hash("test1234!", 10);

  // 기존 DB의 "admin" 계정은 새 아이디로 1회 전환 (비밀번호도 SEED_ADMIN_PASSWORD로 재설정)
  const legacyAdmin = await prisma.user.findUnique({
    where: { username: LEGACY_ADMIN_USERNAME },
  });
  const newAdminExists = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
  });
  if (legacyAdmin && !newAdminExists) {
    await prisma.user.update({
      where: { id: legacyAdmin.id },
      data: { username: ADMIN_USERNAME, passwordHash: adminPassword },
    });
    console.log(`관리자 아이디를 ${LEGACY_ADMIN_USERNAME} → ${ADMIN_USERNAME}로 전환했습니다.`);
  }

  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      username: ADMIN_USERNAME,
      phone: "01000000001",
      passwordHash: adminPassword,
      name: "관리자",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      username: "user",
      phone: "01000000002",
      email: "user@example.com",
      passwordHash: userPassword,
      name: "테스트회원",
    },
  });

  const products = [
    {
      slug: "goodauto-pro",
      name: "GoodAuto Pro",
      summary: "반복 업무를 자동으로 처리하는 데스크톱 자동화 프로그램",
      description:
        "GoodAuto Pro는 클릭, 입력, 데이터 수집 등 반복적인 PC 업무를 자동화하는 데스크톱 프로그램입니다.\n\n주요 기능\n- 매크로 시나리오 편집기: 코딩 없이 자동화 시나리오 구성\n- 스케줄러: 지정한 시간에 자동 실행\n- 엑셀/CSV 데이터 연동\n- 실행 로그 및 오류 알림\n\n구매한 계정으로 프로그램에 로그인하면 즉시 사용할 수 있으며, 마이페이지에서 설치 파일을 다운로드할 수 있습니다.",
      price: 99000,
      category: "PROGRAM" as const,
      downloadFile: "goodauto-pro-setup.zip",
    },
    {
      slug: "ai-automation-starter",
      name: "AI 업무 자동화 스타터",
      summary: "AI가 문서 처리·데이터 정리를 대신하는 소규모 팀용 자동화 패키지",
      description:
        "AI 업무 자동화 스타터는 소규모 팀을 위한 AI 자동화 도입 패키지입니다.\n\n포함 내역\n- 업무 프로세스 분석 및 자동화 설계 (1회)\n- AI 문서 분류/요약 자동화 구축\n- 이메일·보고서 자동 작성 워크플로 구축\n- 1개월 운영 지원\n\n도입 후 반복 문서 업무 시간을 평균 70% 절감할 수 있습니다.",
      price: 490000,
      category: "AI_SERVICE" as const,
    },
    {
      slug: "ai-automation-enterprise",
      name: "AI 업무 자동화 엔터프라이즈",
      summary: "기업 맞춤형 AI 자동화 컨설팅 및 구축 서비스",
      description:
        "AI 업무 자동화 엔터프라이즈는 기업 전체 업무 흐름을 분석하여 맞춤형 AI 자동화 시스템을 구축하는 서비스입니다.\n\n포함 내역\n- 전사 업무 프로세스 진단 및 자동화 로드맵 수립\n- 부서별 맞춤 AI 워크플로 구축 (최대 5개 부서)\n- 사내 시스템(ERP/그룹웨어) 연동\n- 전담 매니저 배정 및 3개월 운영 지원\n- 임직원 교육 2회\n\n도입 기업 평균 연간 1,200시간 이상의 업무 시간을 절감했습니다.",
      price: 1900000,
      category: "AI_SERVICE" as const,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }

  console.log("시드 데이터 생성 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
