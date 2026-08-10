"use client";

import { useActionState, useState } from "react";
import {
  updateProfile,
  changePassword,
  withdrawAccount,
  type AccountFormState,
} from "@/app/mypage/actions";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

function FormMessage({ state }: { state: AccountFormState }) {
  if (state.error) return <p className="text-sm text-red-400">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-accent">{state.ok}</p>;
  return null;
}

export default function AccountSettings({ name }: { name: string }) {
  const [profileState, profileAction, profilePending] = useActionState<
    AccountFormState,
    FormData
  >(updateProfile, {});
  const [passwordState, passwordAction, passwordPending] = useActionState<
    AccountFormState,
    FormData
  >(changePassword, {});
  const [withdrawState, withdrawAction, withdrawPending] = useActionState<
    AccountFormState,
    FormData
  >(withdrawAccount, {});
  const [showWithdraw, setShowWithdraw] = useState(false);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-bold">계정 설정</h2>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {/* 이름 변경 */}
        <form action={profileAction} className="flex flex-col gap-3">
          <p className="text-sm font-medium">이름 변경</p>
          <input
            name="name"
            defaultValue={name}
            required
            minLength={2}
            className={inputClass}
          />
          <FormMessage state={profileState} />
          <button
            type="submit"
            disabled={profilePending}
            className="w-fit rounded-lg border border-line px-5 py-2 text-sm transition hover:border-accent/60 disabled:opacity-50"
          >
            {profilePending ? "저장 중..." : "이름 저장"}
          </button>
        </form>

        {/* 비밀번호 변경 */}
        <form action={passwordAction} className="flex flex-col gap-3">
          <p className="text-sm font-medium">비밀번호 변경</p>
          <input
            name="currentPassword"
            type="password"
            required
            placeholder="현재 비밀번호"
            className={inputClass}
          />
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            placeholder="새 비밀번호 (8자 이상)"
            className={inputClass}
          />
          <input
            name="newPasswordConfirm"
            type="password"
            required
            placeholder="새 비밀번호 확인"
            className={inputClass}
          />
          <FormMessage state={passwordState} />
          <button
            type="submit"
            disabled={passwordPending}
            className="w-fit rounded-lg border border-line px-5 py-2 text-sm transition hover:border-accent/60 disabled:opacity-50"
          >
            {passwordPending ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>

      {/* 회원 탈퇴 */}
      <div className="mt-8 border-t border-line pt-6">
        {!showWithdraw ? (
          <button
            onClick={() => setShowWithdraw(true)}
            className="text-sm text-muted underline transition hover:text-red-400"
          >
            회원 탈퇴
          </button>
        ) : (
          <form action={withdrawAction} className="flex max-w-md flex-col gap-3">
            <p className="text-sm font-medium text-red-400">회원 탈퇴</p>
            <p className="text-xs leading-relaxed text-muted">
              탈퇴 시 계정 정보는 즉시 익명화되며 프로그램 로그인이 차단됩니다.
              주문·결제 기록은 전자상거래법에 따라 법정 기간 동안 보관됩니다.
              구매한 프로그램 사용권도 함께 소멸되며 복구할 수 없습니다.
            </p>
            <input
              name="password"
              type="password"
              required
              placeholder="비밀번호 확인"
              className={inputClass}
            />
            <FormMessage state={withdrawState} />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={withdrawPending}
                className="rounded-lg border border-red-500/40 px-5 py-2 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {withdrawPending ? "처리 중..." : "탈퇴하기"}
              </button>
              <button
                type="button"
                onClick={() => setShowWithdraw(false)}
                className="rounded-lg border border-line px-5 py-2 text-sm text-muted transition hover:text-foreground"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
