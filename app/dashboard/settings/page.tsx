import { redirect } from "next/navigation";
import { getProfile, getSession } from "@/lib/dal";
import ProfileSettings from "./ProfileSettings";
import CompanySettings from "./CompanySettings";

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([getProfile(), getSession()]);
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";

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
        <CompanySettings currentName={profile.companies?.name ?? ""} />
      )}
    </div>
  );
}
