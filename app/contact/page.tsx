import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Build a demo — Casetra",
  description:
    "Tell us how your title team stores, searches, and shares records today, and we'll shape a Casetra demo around your current workflow.",
};

const EXPECT = [
  "A walkthrough shaped around how your team works today — not a generic product tour.",
  "Records, in-document search, audit history, and controlled sharing shown on your kind of files.",
  "A candid look at what moving off scattered folders and email would actually take.",
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0e] font-sans text-[#e8e6df] antialiased selection:bg-[#4763ff]/30 selection:text-white">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0b0e]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] font-serif text-sm font-semibold text-[#f2efe9]">
              C
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight text-[#f2efe9]">
              Casetra
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[#9198a3] transition-colors hover:text-[#f2efe9]"
          >
            <span aria-hidden>←</span> Back to home
          </Link>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 40% at 50% 0%, rgba(71,99,255,0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 pb-24 pt-16 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          {/* Left — positioning */}
          <div className="lg:pt-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a909a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4763ff]" />
              Request a demo
            </span>
            <h1 className="mt-7 font-serif text-[2.35rem] font-medium leading-[1.06] tracking-tight text-[#f4f2ec] sm:text-5xl">
              Build a Casetra demo around your{" "}
              <span className="italic text-[#9db0ff]">title workflow</span>.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#9ca2ac] sm:text-lg">
              Tell us how your team stores, searches, and shares title records
              today. We&rsquo;ll shape a walkthrough around your current workflow.
            </p>

            <div className="mt-10 border-t border-white/[0.08] pt-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7b818c]">
                What to expect
              </p>
              <ul className="mt-5 flex flex-col gap-4">
                {EXPECT.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-[#c2c6cd]">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#4763ff]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6b7079]">
              Private by design · No obligation
            </p>
          </div>

          {/* Right — form */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0f13] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[#6b7079] sm:flex-row">
          <span>© {new Date().getFullYear()} Casetra</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="transition-colors hover:text-[#9ca2ac]">
              Log in
            </Link>
            <Link href="/" className="transition-colors hover:text-[#9ca2ac]">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
