"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertId, requireAdmin } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";

export interface InquiryActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

function revalidateInquiries() {
  revalidatePath("/optix-dev/inquiries");
  revalidatePath("/optix-dev");
}

const updateSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(["NEW", "IN_PROGRESS", "DONE"]),
  adminMemo: z.string().trim().max(1000, "메모는 1000자 이내로 입력하세요."),
});

/** 문의 처리 상태·관리자 메모 저장 */
export async function updateInquiry(
  _prev: InquiryActionState,
  formData: FormData
): Promise<InquiryActionState> {
  const session = await requireAdmin();

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    adminMemo: formData.get("adminMemo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  const { id, status, adminMemo } = parsed.data;
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return { error: "문의를 찾을 수 없습니다." };

  await prisma.inquiry.update({
    where: { id },
    data: { status, adminMemo: adminMemo || null },
  });
  await writeAudit({
    actor: session.user,
    action: "ADMIN_INQUIRY_UPDATED",
    targetType: "inquiry",
    targetId: id,
    detail: { from: inquiry.status, to: status, memoChanged: (inquiry.adminMemo ?? "") !== adminMemo },
  });
  revalidateInquiries();
  return { ok: true, message: "저장했습니다." };
}

/** 스팸 등 불필요한 문의 삭제 */
export async function deleteInquiry(id: string) {
  const session = await requireAdmin();
  assertId(id, "inquiryId");
  const deleted = await prisma.inquiry.delete({ where: { id } }).catch(() => null);
  if (deleted) {
    await writeAudit({
      actor: session.user,
      action: "ADMIN_INQUIRY_DELETED",
      targetType: "inquiry",
      targetId: id,
      detail: { status: deleted.status, createdAt: deleted.createdAt.toISOString() },
    });
  }
  revalidateInquiries();
}
