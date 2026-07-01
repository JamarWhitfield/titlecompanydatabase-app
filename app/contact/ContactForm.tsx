"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitDemoRequest } from "@/app/actions/contact";
import {
  COMPANY_TYPES,
  TEAM_SIZES,
  CURRENT_SYSTEMS,
  PAIN_POINTS,
} from "@/lib/contactOptions";

/* Dark editorial field styling, tuned to the landing palette. */
const labelClass = "text-sm font-medium text-[#cfd3da]";
const fieldClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#f2efe9] placeholder:text-[#6b7079] transition-colors focus:border-[#4763ff]/60 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-[#4763ff]/35";
const selectClass = `${fieldClass} appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-10`;
// Inline chevron so the native select arrow matches the dark theme.
const selectStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237b818c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundSize: "16px",
} as const;
const optionClass = "bg-[#0d0f13] text-[#f2efe9]";

function Field({
  id,
  label,
  children,
  optional = false,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-[#6b7079]">
            Optional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function ContactForm() {
  const [state, action, pending] = useActionState(submitDemoRequest, undefined);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#4763ff]">
          Request received
        </p>
        <h2 className="mt-4 font-serif text-2xl text-[#f4f2ec] sm:text-3xl">
          Thanks — we received your request.
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#9ca2ac]">
          We&rsquo;ll review your workflow and follow up about building a Casetra
          demo.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#9db0ff] transition-colors hover:text-[#c3ccff]"
        >
          <span aria-hidden>←</span> Back to home
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      {/* Honeypot — hidden from humans, tempting to bots. Server discards any
          submission where this is filled. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company_fax">Do not fill this field</label>
        <input
          id="company_fax"
          name="company_fax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field id="full_name" label="Full name">
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Jane Smith"
            className={fieldClass}
          />
        </Field>

        <Field id="email" label="Work email">
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            placeholder="jane@titleco.com"
            className={fieldClass}
          />
        </Field>

        <Field id="company_name" label="Company name">
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            maxLength={160}
            autoComplete="organization"
            placeholder="Acme Title Co."
            className={fieldClass}
          />
        </Field>

        <Field id="company_website" label="Company website" optional>
          <input
            id="company_website"
            name="company_website"
            type="text"
            inputMode="url"
            maxLength={300}
            autoComplete="url"
            placeholder="acmetitle.com"
            className={fieldClass}
          />
        </Field>

        <Field id="role_title" label="Role / title" optional>
          <input
            id="role_title"
            name="role_title"
            type="text"
            maxLength={120}
            autoComplete="organization-title"
            placeholder="Operations Lead"
            className={fieldClass}
          />
        </Field>

        <Field id="company_type" label="Company type" optional>
          <select
            id="company_type"
            name="company_type"
            defaultValue=""
            className={selectClass}
            style={selectStyle}
          >
            <option value="" className={optionClass}>
              Select…
            </option>
            {COMPANY_TYPES.map((opt) => (
              <option key={opt} value={opt} className={optionClass}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field id="team_size" label="Approximate team size" optional>
          <select
            id="team_size"
            name="team_size"
            defaultValue=""
            className={selectClass}
            style={selectStyle}
          >
            <option value="" className={optionClass}>
              Select…
            </option>
            {TEAM_SIZES.map((opt) => (
              <option key={opt} value={opt} className={optionClass}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field id="current_system" label="Current system" optional>
          <select
            id="current_system"
            name="current_system"
            defaultValue=""
            className={selectClass}
            style={selectStyle}
          >
            <option value="" className={optionClass}>
              Select…
            </option>
            {CURRENT_SYSTEMS.map((opt) => (
              <option key={opt} value={opt} className={optionClass}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="main_pain_point" label="Main pain point" optional>
        <select
          id="main_pain_point"
          name="main_pain_point"
          defaultValue=""
          className={selectClass}
          style={selectStyle}
        >
          <option value="" className={optionClass}>
            Select…
          </option>
          {PAIN_POINTS.map((opt) => (
            <option key={opt} value={opt} className={optionClass}>
              {opt}
            </option>
          ))}
        </select>
      </Field>

      <Field id="message" label="Anything else we should know?" optional>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={4000}
          placeholder="Tell us how your team stores, searches, and shares title records today."
          className={`${fieldClass} resize-y`}
        />
      </Field>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-relaxed text-[#7b818c]">
          We use your details only to prepare and follow up on your demo.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4763ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_34px_-10px_rgba(71,99,255,0.75)] transition-colors hover:bg-[#5a73ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4763ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sending…" : "Build my demo"}
        </button>
      </div>
    </form>
  );
}
