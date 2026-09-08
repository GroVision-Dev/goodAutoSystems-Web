# 월 결제(청구서) 시스템 설계

## 목적
관리자가 회원별로 월 결제 금액을 설정하고, 회원이 마이페이지에서 해당 월 청구서를 확인·결제하는 기능.
청구서는 **관리자 수동 발행**만 지원한다(자동 생성·크론 없음).

## 데이터 모델
- `User.monthlyAmount Int?`, `User.monthlyTitle String?` — 회원별 월 결제 설정. 일괄 발행 시 기본값으로 사용.
- `Invoice` — 청구서. `userId`, `billingMonth("YYYY-MM")`, `title`, `amount`, `memo?`, `status(UNPAID|PAID|CANCELED)`, `paidAt?`.
  `@@unique([userId, billingMonth])` — 회원당 한 달에 한 장.
- `Order.productId`를 선택으로 변경, `Order.invoiceId?` 추가. 상품 주문과 청구서 결제가 같은 결제 승인·취소·금액 검증 흐름을 공유한다.

## 관리자
- 사이드 메뉴 **월결제 관리** `/admin/billing`
  - 청구서 목록(월·상태·회원 검색), 미납 청구서 취소
  - 개별 발행 폼(회원 선택, 청구 월, 항목명, 금액, 메모)
  - "N월 청구서 일괄 생성": `monthlyAmount > 0`인 활성 회원 중 해당 월 청구서가 없는 회원에게 생성
- 회원관리 행에 **월결제 설정**(금액·항목명) 인라인 폼

## 회원
- 마이페이지 **월 결제** 섹션: 청구서 목록(월·항목·금액·상태·납부일), 미납 건 "결제하기"
- `/checkout/invoice/[id]` — 기존 토스 위젯 컴포넌트 재사용. `POST /api/orders {invoiceId}`로 PENDING 주문 생성 후 `/checkout/success`에서 승인 → `Order.PAID` + `Invoice.PAID`.
- 관리자가 결제 취소(환불)하면 `Invoice`는 `UNPAID`로 되돌린다.

## 검증
- 금액은 항상 서버의 `Invoice.amount`로 확정. 본인 청구서만 결제 가능. 이미 PAID/CANCELED면 결제 불가.
