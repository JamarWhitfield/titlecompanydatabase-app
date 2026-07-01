"use client";

import { useEffect, useRef, useState } from "react";

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
function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ── Visual frame shared by each step illustration ─────────────── */
function Frame({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d0f13] p-5">
      <span className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#565c66]">
        {tag}
      </span>
      {children}
    </div>
  );
}

/* ── Step visuals ──────────────────────────────────────────────── */
function WorkspaceVisual() {
  const members = [
    { i: "JR", r: "Admin" },
    { i: "SM", r: "Member" },
    { i: "DK", r: "Member" },
  ];
  return (
    <Frame tag="Workspace">
      <div className="flex h-full flex-col justify-center">
        <div className="rounded-lg border border-dashed border-white/15 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] font-serif text-xs text-[#9db0ff]">
                G
              </span>
              <span className="text-xs text-[#e8e6df]">Gulf Coast Title Co.</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#7b818c]">
              <LockIcon className="h-3 w-3" /> Private
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.i}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4763ff]/15 font-mono text-[9px] text-[#9db0ff]">
                  {m.i}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wide text-[#8a909a]">
                  {m.r}
                </span>
              </span>
            ))}
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] text-[#7b818c]">
              +3
            </span>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#565c66]">
          Company-scoped access
        </p>
      </div>
    </Frame>
  );
}

function ImportVisual() {
  const docs = ["Abstract.pdf", "Exhibit-A.pdf", "Survey.jpg"];
  return (
    <Frame tag="Import">
      <div className="flex h-full items-center gap-4">
        <div className="flex flex-1 flex-col gap-2">
          {docs.map((d) => (
            <div
              key={d}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2"
            >
              <DocIcon className="h-3.5 w-3.5 text-[#565c66]" />
              <span className="font-mono text-[10px] text-[#9ca2ac]">{d}</span>
            </div>
          ))}
        </div>
        <ArrowIcon className="h-5 w-5 shrink-0 text-[#4763ff]" />
        <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[#565c66]">
            Record
          </p>
          <p className="mt-1 text-xs text-[#e8e6df]">1420 Prytania St</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4763ff]" />
            <span className="font-mono text-[9px] text-[#7b818c]">3 files indexed</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SearchVisual() {
  const lines = [
    "Lien search — 1420 Prytania St",
    "highlight",
    "Metadata · Orleans, LA · Abstract",
  ];
  return (
    <Frame tag="Search">
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <SearchIcon className="h-4 w-4 text-[#9db0ff]" />
          <span className="font-mono text-[11px] text-[#9ca2ac]">parcel 7B</span>
          <span className="ml-auto h-3.5 w-px animate-pulse bg-[#4763ff]/70" />
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] leading-relaxed text-[#8a909a]"
            >
              {line === "highlight" ? (
                <span>
                  …legal description,{" "}
                  <mark className="rounded bg-[#4763ff]/25 px-1 text-[#cdd6ff]">
                    Parcel 7B
                  </mark>
                  , Orleans Parish…
                </span>
              ) : (
                line
              )}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ShareVisual() {
  return (
    <Frame tag="Share">
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="rounded-lg border border-[#4763ff]/30 bg-[#4763ff]/[0.06] p-3">
          <div className="flex items-center gap-2">
            <NetworkIcon className="h-4 w-4 text-[#9db0ff]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#9db0ff]">
              Trusted network
            </span>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <span className="h-1.5 flex-1 rounded-full bg-[#4763ff]/30" />
            <span className="h-1.5 flex-1 rounded-full bg-[#4763ff]/30" />
            <span className="h-1.5 flex-1 rounded-full bg-[#4763ff]/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#565c66]">
            shared when you choose
          </span>
          <ArrowIcon className="h-3.5 w-3.5 -rotate-90 text-[#4763ff]" />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#e8e6df]">1420 Prytania St</span>
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[#7b818c]">
              <LockIcon className="h-3 w-3" /> private
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function AuditVisual() {
  const rows = [
    { t: "10:24", u: "J. Rivera", a: "Shared record" },
    { t: "10:19", u: "S. Mabry", a: "Uploaded file" },
    { t: "09:58", u: "D. Keller", a: "Edited record" },
    { t: "09:41", u: "J. Rivera", a: "Created record" },
  ];
  return (
    <Frame tag="Audit">
      <div className="flex h-full flex-col justify-center">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 font-mono text-[9px] uppercase tracking-wider text-[#565c66]">
          <span>Time</span>
          <span>User · Action</span>
          <span>Status</span>
        </div>
        <div className="mt-2 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {rows.map((r) => (
            <div
              key={r.t}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 py-2"
            >
              <span className="font-mono text-[10px] text-[#7b818c]">{r.t}</span>
              <span className="truncate text-[11px] text-[#c7ccd4]">
                <span className="text-[#9db0ff]">{r.u}</span> · {r.a}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase text-[#5a9c82]">
                <CheckIcon className="h-3 w-3" /> ok
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-[#565c66]">
          Immutable trail
        </p>
      </div>
    </Frame>
  );
}

/* ── Content ───────────────────────────────────────────────────── */
const STEPS = [
  {
    num: "01",
    title: "Create your company workspace",
    body: "Register your firm and invite your team into a private, company-scoped workspace.",
    Visual: WorkspaceVisual,
  },
  {
    num: "02",
    title: "Import records and documents",
    body: "Bring in abstracts, exhibits, Qualia files, PDFs, images, and supporting documents.",
    Visual: ImportVisual,
  },
  {
    num: "03",
    title: "Search across titles, metadata, and file contents",
    body: "Find records by title, county, state, parcel details, notes, or text extracted from uploaded files.",
    Visual: SearchVisual,
  },
  {
    num: "04",
    title: "Share selected records to the network",
    body: "Publish only the records you choose. Private files remain protected unless explicitly shared.",
    Visual: ShareVisual,
  },
  {
    num: "05",
    title: "Track every action with audit logs",
    body: "Record creation, edits, uploads, sharing, and file activity are captured in an immutable audit trail.",
    Visual: AuditVisual,
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    STEPS.map(() => false),
  );
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const els = stepRefs.current.filter(
      (el): el is HTMLLIElement => el !== null,
    );
    if (els.length === 0) return;

    // Active step = the row currently crossing the vertical center of the viewport.
    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    // Reveal = subtle entrance the first time a row scrolls into view.
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setRevealed((prev) => {
                if (prev[idx]) return prev;
                const next = [...prev];
                next[idx] = true;
                return next;
              });
            }
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );

    for (const el of els) {
      activeObserver.observe(el);
      revealObserver.observe(el);
    }
    return () => {
      activeObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  const progress = ((active + 1) / STEPS.length) * 100;

  return (
    <section
      id="how-it-works"
      className="border-t border-white/[0.06] py-24 sm:py-28"
    >
      {/* No-JS / observer fallback: never leave content hidden. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: ".hiw-step{opacity:1!important;transform:none!important}",
          }}
        />
      </noscript>

      <div className="mx-auto max-w-6xl px-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* ── Left: sticky panel ─────────────────────────── */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <span className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#7b818c]">
                <span className="h-px w-7 bg-[#4763ff]/70" />
                How it works
              </span>
              <h2 className="mt-6 font-serif text-3xl font-medium leading-[1.12] tracking-tight text-[#f2efe9] sm:text-[2.6rem]">
                Built around how title teams already work.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#9ca2ac]">
                Casetra fits the way title companies already manage records,
                documents, sharing, and accountability — then makes the entire
                workflow searchable and controlled.
              </p>

              {/* progress + changing visual (desktop only) */}
              <div className="mt-10 hidden lg:block">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-[#9db0ff]">
                    {String(active + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1 bg-white/10">
                    <div
                      className="h-px bg-[#4763ff] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-[#565c66]">
                    {String(STEPS.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="relative mt-6 aspect-[4/3] w-full" aria-hidden>
                  {STEPS.map((s, i) => {
                    const V = s.Visual;
                    return (
                      <div
                        key={s.num}
                        className={`absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none ${
                          active === i
                            ? "opacity-100 motion-safe:translate-y-0"
                            : "pointer-events-none opacity-0 motion-safe:translate-y-3"
                        }`}
                      >
                        <V />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: workflow steps ──────────────────────── */}
          <div className="mt-12 lg:col-span-7 lg:mt-0">
            <ol>
              {STEPS.map((s, i) => {
                const isActive = active === i;
                const V = s.Visual;
                return (
                  <li
                    key={s.num}
                    ref={(el) => {
                      stepRefs.current[i] = el;
                    }}
                    data-index={i}
                    className={`hiw-step transition-all duration-700 ease-out motion-reduce:transition-none ${
                      revealed[i]
                        ? "translate-y-0 opacity-100"
                        : "motion-safe:translate-y-4 motion-safe:opacity-0"
                    }`}
                  >
                    <div
                      className={`border-l-2 border-t py-8 pl-5 transition-colors duration-500 motion-reduce:transition-none lg:flex lg:min-h-[38vh] lg:flex-col lg:justify-center ${
                        isActive
                          ? "border-l-[#4763ff] border-t-white/[0.08]"
                          : "border-l-white/[0.08] border-t-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={`w-9 shrink-0 font-mono text-2xl transition-colors duration-500 motion-reduce:transition-none ${
                            isActive ? "text-[#9db0ff]" : "text-[#3f4650]"
                          }`}
                        >
                          {s.num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`font-serif text-xl font-medium leading-snug transition-colors duration-500 motion-reduce:transition-none sm:text-2xl ${
                              isActive ? "text-[#f4f2ec]" : "text-[#8a909a]"
                            }`}
                          >
                            {s.title}
                          </h3>
                          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#9298a2]">
                            {s.body}
                          </p>

                          {/* inline visual (mobile only) */}
                          <div className="mt-6 aspect-[4/3] lg:hidden" aria-hidden>
                            <V />
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
