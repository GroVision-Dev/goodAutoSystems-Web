"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelPayment, PortOneApiError } from "@/lib/portone";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return session;
}

export async function toggleUserStatus(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) throw new Error("본인 계정은 정지할 수 없습니다.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("회원을 찾을 수 없습니다.");
  if (user.status === "WITHDRAWN") throw new Error("탈퇴한 회원입니다.");

  await prisma.user.update({
    where: { id: userId },
    data: { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
  });
  revalidatePath("/admin/users");
}

export async function toggleUserRole(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) throw new Error("본인 권한은 변경할 수 없습니다.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("회원을 찾을 수 없습니다.");
  if (user.status === "WITHDRAWN") throw new Error("탈퇴한 회원입니다.");

  await prisma.user.update({
    where: { id: userId },
    data: { role: user.role === "ADMIN" ? "USER" : "ADMIN" },
  });
  revalidatePath("/admin/users");
}

export interface CancelOrderState {
  error?: string;
  ok?: boolean;
}

/** 결제 취소(환불): 포트원 취소 API 호출 후 주문을 CANCELED로 전환 */
export async function cancelOrder(
  _prev: CancelOrderState,
  formData: FormData
): Promise<CancelOrderState> {
  await requireAdmin();

  const orderId = formData.get("orderId") as string;
  const reason = ((formData.get("reason") as string) || "관리자 취소").trim();

  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) return { error: "주문을 찾을 수 없습니다." };
  if (order.status !== "PAID") return { error: "결제 완료 상태의 주문만 취소할 수 있습니다." };

  if (order.paymentKey) {
    try {
      // 포트원 취소는 paymentId(=주문번호) 기준으로 호출한다
      await cancelPayment(order.orderId, reason);
    } catch (e) {
      const message =
        e instanceof PortOneApiError ? e.message : "결제 취소 중 오류가 발생했습니다.";
      return { error: `포트원 결제취소 실패: ${message}` };
    }
  }
  // paymentKey가 없는 주문(테스트 데이터)은 포트원 호출 없이 상태만 변경한다.

  await prisma.$transaction([
    prisma.order.update({
      where: { orderId },
      data: { status: "CANCELED", failReason: reason },
    }),
    // 청구서 결제를 환불하면 청구서는 다시 미납 상태로 되돌린다.
    ...(order.invoiceId
      ? [
          prisma.invoice.update({
            where: { id: order.invoiceId },
            data: { status: "UNPAID", paidAt: null },
          }),
        ]
      : []),
  ]);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/billing");
  revalidatePath("/mypage");
  return { ok: true };
}

export async function deleteProduct(productId: string) {
  await requireAdmin();

  const orderCount = await prisma.order.count({ where: { productId } });
  if (orderCount > 0) {
    throw new Error("주문 이력이 있는 상품은 삭제할 수 없습니다. 대신 숨김 처리하세요.");
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}

const productSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요."),
  slug: z
    .string()
    .min(1, "슬러그를 입력하세요.")
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자·숫자·하이픈만 사용할 수 있습니다."),
  summary: z.string().min(1, "요약을 입력하세요."),
  description: z.string().min(1, "상세 설명을 입력하세요."),
  price: z.coerce.number().int().min(100, "가격은 100원 이상이어야 합니다."),
  category: z.enum(["PROGRAM", "AI_SERVICE"]),
  downloadFile: z.string().optional(),
});

export interface ProductFormState {
  error?: string;
  ok?: boolean;
}

export async function saveProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category"),
    downloadFile: (formData.get("downloadFile") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  const id = (formData.get("id") as string) || null;
  const data = {
    ...parsed.data,
    downloadFile: parsed.data.downloadFile || null,
  };

  const slugOwner = await prisma.product.findUnique({
    where: { slug: data.slug },
  });
  if (slugOwner && slugOwner.id !== id) {
    return { error: "이미 사용 중인 슬러그입니다." };
  }

  if (id) {
    await prisma.product.update({ where: { id }, data });
  } else {
    await prisma.product.create({ data });
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleProductActive(productId: string) {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("상품을 찾을 수 없습니다.");

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: !product.isActive },
  });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}
