import { redirect } from "next/navigation";
import { getProfile, getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import ProfileSettings from "./ProfileSettings";
import CompanySettings from "./CompanySettings";
import StorageUsage from "./StorageUsage";

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([getProfile(), getSession()]);
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";

  // Company storage usage is derived from record_files.size (database
  // metadata) via an RPC — never by listing the Storage bucket. This is the
  // billable, application-level figure. Admins only.
  let usage = { total_bytes: 0, file_count: 0 };
  if (isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_company_storage_usage");
    if (data && data.length > 0) usage = data[0];
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile
          {isAdmin ? " and company details" : ""}.
        </p>
      </div>

      <ProfileSettings
        currentName={profile.full_name ?? ""}
        email={user?.email ?? ""}
        role={profile.role}
      />

      {isAdmin && (
        <>
          <CompanySettings currentName={profile.companies?.name ?? ""} />
          <StorageUsage
            totalBytes={usage.total_bytes}
            fileCount={usage.file_count}
          />
        </>
      )}
    </div>
  );
}
