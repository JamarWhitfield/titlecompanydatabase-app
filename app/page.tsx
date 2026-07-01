import Link from "next/link";
import HowItWorks from "./HowItWorks";

// Root page — authenticated users are redirected to /dashboard via middleware.
// Unauthenticated visitors see this landing page.

/* ── Custom line icons (no emoji) ──────────────────────────────── */
type IconProps = { className?: string };
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function DocIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function SearchIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function NetworkIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M10.3 6.9 6.7 16.6M13.7 6.9l3.6 9.7M7.5 19h9" />
    </svg>
  );
}
function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function UsersIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.3A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  );
}
function AuditIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
      <path d="m8.5 13 1.5 1.5 3-3" />
      <path d="M8.5 17.5h4" />
    </svg>
  );
}
function LockIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function CheckIcon({ className }: IconProps) {
  return (
    <svg {...svg} strokeWidth={1.8} className={className} aria-hidden>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

/* ── Shared button styles (restrained electric-cobalt) ─────────── */
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#4763ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_34px_-10px_rgba(71,99,255,0.75)] transition-colors hover:bg-[#5a73ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4763ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.02] px-5 py-2.5 text-sm font-semibold text-[#e8e6df] transition-colors hover:border-white/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]";

/* ── Content ───────────────────────────────────────────────────── */
const PROBLEMS = [
  "Records are scattered across email threads, shared drives, PDFs, and legacy systems no one fully trusts.",
  "Staff lose hours hunting for abstracts and Qualia files buried in a single inbox or an old folder.",
  "Sharing with partner companies means attachments and reply-all — with no clean record of what was sent.",
  "There is little visibility into who opened, edited, or forwarded a file, and when it happened.",
];

const FEATURES = [
  {
    Icon: DocIcon,
    title: "Centralized record management",
    body: "Every abstract, title file, and supporting document in one permanent, organized workspace — never scattered across drives and inboxes again.",
  },
  {
    Icon: SearchIcon,
    title: "Full-text document search",
    body: "Casetra extracts and indexes the text inside your uploads, so a parcel number or a name buried on page nine is a single query away.",
  },
  {
    Icon: NetworkIcon,
    title: "Controlled network sharing",
    body: "Publish a record to the trusted network with one deliberate action. Partner firms discover the record; the underlying file stays under your control.",
  },
  {
    Icon: UsersIcon,
    title: "Team roles and permissions",
    body: "Grant admin or member access and revoke it the moment a role changes. Sensitive actions stay limited to the people you choose.",
  },
  {
    Icon: AuditIcon,
    title: "Immutable audit trail",
    body: "Every create, edit, share, and download is written to a permanent log. When a client asks who touched a file, the answer takes seconds.",
  },
  {
    Icon: LockIcon,
    title: "Private by default",
    body: "Each record is sealed to your company until you decide otherwise. Isolation is enforced at the database layer, not merely hidden in the interface.",
  },
];

const TRUST = [
  {
    Icon: LockIcon,
    title: "Company data is isolated",
    body: "Each firm keeps its records behind row-level security, enforced in the database itself.",
  },
  {
    Icon: ShieldIcon,
    title: "Private unless explicitly shared",
    body: "Records are private the moment they are created and stay that way until you choose to share them.",
  },
  {
    Icon: NetworkIcon,
    title: "Sharing is controlled",
    body: "Publishing to the network is a single, deliberate act — never automatic and never silent.",
  },
  {
    Icon: CheckIcon,
    title: "Authorized file access",
    body: "Document access runs through authorization checks on every request, not just interface rules.",
  },
  {
    Icon: AuditIcon,
    title: "Every action is logged",
    body: "Create, edit, share, and download events are written to a permanent, reviewable audit trail.",
  },
  {
    Icon: UsersIcon,
    title: "Roles protect sensitive actions",
    body: "Admin and member roles keep sharing, team changes, and deletions in the right hands.",
  },
];

/* ── Product visual: a dark record-layer panel ─────────────────── */
function RecordLayerVisual() {
  const rows = [
    { title: "1420 Prytania St — Lien Search", meta: "PARCEL 7B · ORLEANS, LA", shared: false },
    { title: "Bayou Vista Subdivision — Lot 12", meta: "PARCEL 118 · JEFFERSON, LA", shared: true },
    { title: "Highway 90 Commercial Tract", meta: "PARCEL 44A · HARRISON, MS", shared: false },
    { title: "Magnolia Estates — Parcel 7B", meta: "PARCEL 7B · MOBILE, AL", shared: true },
  ];
  return (
    <div className="relative">
      {/* accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-12 bottom-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 0%, rgba(71,99,255,0.20), transparent 70%)",
        }}
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d0f13] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <div className="ml-3 hidden rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-[#6b7079] sm:block">
            app.casetra.com/records
          </div>
        </div>
        {/* search bar */}
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <SearchIcon className="h-4 w-4 text-[#9db0ff]" />
            <span className="font-mono text-[11px] tracking-wide text-[#7b818c]">
              parcel:7B county:orleans
            </span>
            <span className="ml-auto h-4 w-px animate-pulse bg-[#4763ff]/70" />
          </div>
        </div>
        {/* record rows */}
        <div className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <div key={r.title} className="flex items-center gap-3 px-4 py-3.5">
              <DocIcon className="h-4 w-4 shrink-0 text-[#565c66]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#e8e6df]">{r.title}</p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wide text-[#5a616b]">
                  {r.meta}
                </p>
              </div>
              {r.shared ? (
                <span className="shrink-0 rounded-full border border-[#4763ff]/40 bg-[#4763ff]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#9db0ff]">
                  Shared
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#6b7079]">
                  Private
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* floating detail chips */}
      <div className="absolute -left-3 top-24 hidden items-center gap-2 rounded-lg border border-white/10 bg-[#0d0f13]/90 px-3 py-2 shadow-2xl backdrop-blur sm:flex lg:-left-8">
        <SearchIcon className="h-3.5 w-3.5 text-[#9db0ff]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a909a]">
          Text extracted
        </span>
      </div>
      <div className="absolute -right-3 bottom-14 hidden items-center gap-2 rounded-lg border border-white/10 bg-[#0d0f13]/90 px-3 py-2 shadow-2xl backdrop-blur sm:flex lg:-right-8">
        <AuditIcon className="h-3.5 w-3.5 text-[#9db0ff]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a909a]">
          Audit logged
        </span>
      </div>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#7b818c]">
      <span className="h-px w-7 bg-[#4763ff]/70" />
      {children}
    </span>
  );
}

export default function Home() {
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
          <nav className="hidden items-center gap-9 text-sm text-[#9198a3] md:flex">
            <a href="#platform" className="transition-colors hover:text-[#f2efe9]">
              Platform
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-[#f2efe9]">
              How it works
            </a>
            <a href="#trust" className="transition-colors hover:text-[#f2efe9]">
              Trust
            </a>
          </nav>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/login"
              className="text-sm text-[#9198a3] transition-colors hover:text-[#f2efe9]"
            >
              Log in
            </Link>
            <Link href="/contact" className={btnPrimary}>
              Book a demo
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 45% at 50% 0%, rgba(71,99,255,0.14), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "58px 58px",
            maskImage:
              "radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 78%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a909a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4763ff]" />
              Title record infrastructure
            </span>
            <h1 className="mt-7 font-serif text-[2.6rem] font-medium leading-[1.04] tracking-tight text-[#f4f2ec] sm:text-6xl">
              The secure record layer for{" "}
              <span className="italic text-[#9db0ff]">title companies</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#9ca2ac] sm:text-lg">
              Casetra helps title teams centralize abstracts, search inside
              uploaded documents, audit every action, and share records through a
              controlled industry network.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/contact" className={btnPrimary}>
                Book a demo
              </Link>
              <a href="#how-it-works" className={btnSecondary}>
                See how it works
              </a>
            </div>
            <p className="mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6b7079]">
              <LockIcon className="h-3.5 w-3.5 text-[#4763ff]" />
              Private by default · Audited by design
            </p>
          </div>

          {/* product visual */}
          <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
            <RecordLayerVisual />
          </div>
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────── */}
      <section id="problem" className="border-t border-white/[0.06] py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <Label>The problem</Label>
              <h2 className="mt-6 max-w-md font-serif text-3xl font-medium leading-[1.1] tracking-tight text-[#f2efe9] sm:text-[2.6rem]">
                Title records were never meant to live in inboxes.
              </h2>
            </div>
            <ul className="flex flex-col">
              {PROBLEMS.map((p, i) => (
                <li
                  key={p}
                  className="flex gap-5 border-b border-white/[0.08] py-6 first:pt-0 last:border-0"
                >
                  <span className="font-mono text-xs text-[#4763ff]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[15px] leading-relaxed text-[#9ca2ac]">{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Platform ────────────────────────────────────────── */}
      <section id="platform" className="border-t border-white/[0.06] py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <Label>The platform</Label>
            <h2 className="mt-6 font-serif text-3xl font-medium leading-[1.12] tracking-tight text-[#f2efe9] sm:text-[2.6rem]">
              One controlled workspace for private records, searchable files, and
              shared network access.
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#0b0d11] p-8 transition-colors hover:bg-[#0f1218]"
              >
                <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#9db0ff]">
                  <f.Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-2 font-serif text-lg font-semibold text-[#f2efe9]">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#9298a2]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (interactive scrollytelling) ───────── */}
      <HowItWorks />

      {/* ── Trust ───────────────────────────────────────────── */}
      <section
        id="trust"
        className="relative overflow-hidden border-t border-white/[0.06] py-24 sm:py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "58px 58px",
            maskImage:
              "radial-gradient(80% 70% at 20% 0%, #000, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(80% 70% at 20% 0%, #000, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <Label>Trust</Label>
              <h2 className="mt-6 max-w-md font-serif text-3xl font-medium leading-[1.1] tracking-tight text-[#f2efe9] sm:text-[2.6rem]">
                Private by default. Shared only when you choose.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#9ca2ac]">
                Casetra is built so that discretion is the default state, not a
                setting you have to remember to switch on. Isolation, sharing, and
                access are enforced by the platform — and every action is recorded.
              </p>
              <a
                href="#how-it-works"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#9db0ff] transition-colors hover:text-[#c3ccff]"
              >
                See how sharing controls work
                <span aria-hidden>→</span>
              </a>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {TRUST.map((t) => (
                <div key={t.title} className="bg-[#0b0d11] p-6">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[#9db0ff]">
                    <t.Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-[#f2efe9]">
                    {t.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#9298a2]">
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo CTA ────────────────────────────────────────── */}
      <section
        id="demo"
        className="relative overflow-hidden border-t border-white/[0.06] py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 50%, rgba(71,99,255,0.16), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="flex justify-center">
            <Label>Demo</Label>
          </div>
          <h2 className="mt-6 font-serif text-4xl font-medium leading-[1.1] tracking-tight text-[#f4f2ec] sm:text-5xl">
            Have us build your Casetra demo around your workflow.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[#9ca2ac] sm:text-base">
            Show us how your team stores, searches, and shares title records
            today. We&rsquo;ll shape a demo around your real operating model.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/contact" className={btnPrimary}>
              Book a demo
            </Link>
          </div>
          <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.16em] text-[#6b7079]">
            No pricing page · No generic trial · A guided walkthrough
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-serif text-xs font-semibold text-[#f2efe9]">
              C
            </span>
            <span className="font-serif text-sm font-semibold text-[#f2efe9]">
              Casetra
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-sm text-[#8a909a]">
            <a href="#platform" className="transition-colors hover:text-[#f2efe9]">
              Platform
            </a>
            <a href="#trust" className="transition-colors hover:text-[#f2efe9]">
              Trust
            </a>
            <Link href="/login" className="transition-colors hover:text-[#f2efe9]">
              Log in
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-[#9db0ff]"
            >
              Book a demo
            </Link>
          </nav>
          <p className="font-mono text-[11px] text-[#5a616b]">
            © {new Date().getFullYear()} Casetra
          </p>
        </div>
      </footer>
    </div>
  );
}
