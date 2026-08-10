"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.user.update({
    where: { id: userId },
    data: { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
  });
  revalidatePath("/admin/users");
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
