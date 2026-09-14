import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { INQUIRY_STATUS } from "@/lib/inquiry";
import { formatPhone } from "@/lib/phone";
import { requireAdminPage } from "@/lib/auth-guard";
import { logAdminView } from "@/lib/audit";
import AdminInquiryControls from "@/components/admin-inquiry-controls";
import { deleteInquiry } from "./actions";

export const metadata = { title: "문의 관리" };

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdminPage();
  const { q, status } = await searchParams;
  await logAdminView(session, "ADMIN_VIEW_INQUIRIES", { q, status });

  const [inquiries, products, newCount] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        ...(status && status in INQUIRY_STATUS
          ? { status: status as "NEW" | "IN_PROGRESS" | "DONE" }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { company: { contains: q } },
                { email: { contains: q.toLowerCase() } },
                { phone: { contains: q.replace(/\D/g, "") || q } },
                { message: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({ select: { slug: true, name: true } }),
    prisma.inquiry.count({ where: { status: "NEW" } }),
  ]);
  const productName = new Map(products.map((p) => [p.slug, p.name]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">문의 관리</h1>
          <p className="mt-1 text-xs text-muted">
            조회 결과 {inquiries.length}건
            {newCount > 0 && (
              <>
                {" "}
                · <span className="text-accent-2">미확인 신규 {newCount}건</span>
              </>
            )}
          </p>
        </div>
        <form className="flex w-full flex-wrap gap-2 text-sm sm:w-auto">
          <select name="status" defaultValue={status ?? ""} className={filterClass}>
            <option value="">전체 상태</option>
            <option value="NEW">신규</option>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="DONE">처리 완료</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="이름/회사/연락처/내용 검색"
            className={`${filterClass} min-w-0 flex-1 sm:w-56 sm:flex-none`}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      {inquiries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-10 text-center text-sm text-muted">
          조건에 맞는 문의가 없습니다. 홈 하단 문의 섹션이나 /contact에서 접수된 문의가 여기에 표시됩니다.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {inquiries.map((inq) => {
            const badge = INQUIRY_STATUS[inq.status];
            const phoneDigits = inq.phone.replace(/\D/g, "");
            return (
              <li
                key={inq.id}
                className={`rounded-2xl border bg-surface p-5 ${
                  inq.status === "NEW" ? "border-accent-2/40" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{inq.name}</span>
                      {inq.company && <span className="text-sm text-muted">{inq.company}</span>}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                      {inq.productSlug && (
                        <Link
                          href={`/products/${inq.productSlug}`}
                          className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted hover:text-foreground"
                        >
                          {productName.get(inq.productSlug) ?? inq.productSlug}
                        </Link>
                      )}
                    </div>
                    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <a href={`tel:${phoneDigits}`} className="text-accent hover:underline">
                        {formatPhone(inq.phone)}
                      </a>
                      {inq.email && (
                        <a href={`mailto:${inq.email}`} className="text-muted hover:text-foreground">
                          {inq.email}
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{inq.createdAt.toLocaleString("ko-KR")}</p>
                    <p className="mt-0.5">
                      {inq.userId ? "회원" : "비회원"}
                      {inq.ipMasked ? ` · ${inq.ipMasked}` : ""}
                    </p>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-keep rounded-xl bg-surface-2/60 px-4 py-3 text-sm leading-relaxed">
                  {inq.message}
                </p>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-line/60 pt-4">
                  <div className="min-w-0 flex-1">
                    <AdminInquiryControls
                      id={inq.id}
                      status={inq.status}
                      adminMemo={inq.adminMemo}
                    />
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteInquiry(inq.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/10"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">최근 200건까지 표시됩니다. 삭제는 되돌릴 수 없습니다.</p>
    </div>
  );
}
