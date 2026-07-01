import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Profile, CompanyInvitation } from "@/types/database";
import InviteForm from "./InviteForm";
import MembersList from "./MembersList";
import InvitesList from "./InvitesList";
import CompanySettings from "./CompanySettings";

export default async function TeamPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  // Admin-only page. RLS is the database-level backstop — a non-admin would
  // receive zero invitation rows regardless — but we redirect for clarity.
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  // RLS scopes both queries to the caller's own company.
  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("company_invitations")
      .select("*")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const members = (memberRows as Profile[]) ?? [];
  const invitations = (inviteRows as CompanyInvitation[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Team
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Invite teammates to {profile.companies?.name ?? "your company"} and
          manage their access.
        </p>
      </div>

      <CompanySettings currentName={profile.companies?.name ?? ""} />

      <InviteForm />

      <MembersList members={members} currentUserId={profile.id} />

      <InvitesList invitations={invitations} />
    </div>
  );
}
