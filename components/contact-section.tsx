export default function ContactSection() {
  return (
    <section id="contact" className="border-t border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-28">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-accent/15 via-surface to-surface p-6 text-center sm:rounded-3xl sm:p-10 md:p-16">
          <p className="text-sm font-medium text-accent-2 md:text-base">CONTACT</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">
            우리 회사 업무도 자동화할 수 있을까요?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted md:text-base">
            업무 내용을 간단히 보내주시면, 적용 가능 여부와 예상 절감 효과를
            무료로 진단해 드립니다. 영업일 기준 1일 내에 회신드립니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4 md:mt-10">
            <a
              href="mailto:contact@goodautosystems.com?subject=%EC%97%85%EB%AC%B4%20%EC%9E%90%EB%8F%99%ED%99%94%20%EB%8F%84%EC%9E%85%20%EB%AC%B8%EC%9D%98"
              className="rounded-lg bg-accent px-8 py-3.5 font-medium text-white transition hover:bg-accent/80"
            >
              이메일로 문의하기
            </a>
            <a
              href="/register"
              className="rounded-lg border border-line bg-surface/60 px-8 py-3.5 font-medium transition hover:border-accent/60"
            >
              회원가입 후 시작하기
            </a>
          </div>
          <p className="mt-6 flex flex-col gap-1 text-xs text-muted sm:mt-8 sm:block sm:text-sm">
            <span>010-2532-2314</span>
            <span className="hidden sm:inline"> · </span>
            <span>contact@goodautosystems.com</span>
            <span className="hidden sm:inline"> · </span>
            <span>평일 09:00 - 18:00</span>
          </p>
        </div>
      </div>
    </section>
  );
}
