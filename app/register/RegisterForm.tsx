"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/app/actions/auth";

type InviteInfo = {
  token: string;
  email: string;
  companyName: string;
  role: "admin" | "member";
};

export default function RegisterForm({
  invite = null,
}: {
  invite?: InviteInfo | null;
}) {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {invite ? (
        // Joining an existing company via invite — the company is fixed by
        // the token, so we pass it through hidden and lock the email field.
        <input type="hidden" name="invite_token" value={invite.token} />
      ) : (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="company_name"
            className="text-sm font-medium text-gray-700"
          >
            Company name
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            autoComplete="organization"
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Acme Title Co."
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="full_name"
          className="text-sm font-medium text-gray-700"
        >
          Your full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Jane Smith"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={invite?.email}
          readOnly={!!invite}
          className={`rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500${
            invite ? " bg-gray-50 text-gray-500" : ""
          }`}
          placeholder="you@titleco.com"
        />
        {invite && (
          <p className="text-xs text-gray-400">
            This invitation was sent to this address.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Min. 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
