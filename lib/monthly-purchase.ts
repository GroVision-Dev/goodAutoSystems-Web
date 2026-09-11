import { prisma } from "@/lib/prisma";
import { computeDueDate, currentBillingMonth } from "@/lib/billing";

/**
 * 월 결제 상품의 첫 달 결제가 완료된 뒤 호출한다.
 * 1) 회원에게 월 결제 설정이 없으면 상품 금액·이름·결제일(결제한 날짜)을 등록한다
 *    → 다음 달부터 월결제 관리의 "결제 예정 회원"에 나타나고 청구서를 보낼 수 있다.
 * 2) 이번 달 청구서를 "납부 완료"로 만들어 주문에 연결한다
 *    → 회원 마이페이지와 관리자 목록에서 첫 달이 결제된 것으로 보이고, 같은 달 중복 청구를 막는다.
 * 이미 설정·청구서가 있으면 건드리지 않는다.
 */
export async function setupMonthlyBillingAfterPurchase(params: {
  orderId: string;
  userId: string;
  product: { name: string; price: number };
  paidAt: Date;
}): Promise<void> {
  const { orderId, userId, product, paidAt } = params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (!user.monthlyAmount) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyAmount: product.price,
        monthlyTitle: product.name,
        billingDay: paidAt.getDate(),
      },
    });
  }

  const billingMonth = currentBillingMonth(paidAt);
  const existing = await prisma.invoice.findUnique({
    where: { userId_billingMonth: { userId, billingMonth } },
  });
  if (existing) return;

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      billingMonth,
      title: product.name,
      amount: product.price,
      memo: "첫 달 이용료 (상품 주문으로 결제)",
      status: "PAID",
      paidAt,
      dueDate: computeDueDate(billingMonth, paidAt.getDate()),
    },
  });
  await prisma.order.update({ where: { orderId }, data: { invoiceId: invoice.id } });
}
