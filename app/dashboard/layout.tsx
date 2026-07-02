import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { getCurrentPlatformRole } from "@/lib/platform-auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import NavLinks from "./NavLinks";
import FeedbackButton from "./FeedbackButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  // Belt-and-suspenders guard — proxy handles most cases,
  // but layout checks protect against partial-rendering edge cases.
  if (!profile) {
    redirect("/login");
  }

  const company = profile.companies;

  // Platform role is stored separately from the company role; null for the
  // vast majority of users. Drives the (hidden-by-default) Platform nav item.
  const platformRole = await getCurrentPlatformRole();

  // Unread notification count for the nav badge (RLS scopes to own company).
  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              T
            </span>
            Title Network
          </span>
          {company && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-600">
                {company.name}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          <NavLinks
            isAdmin={profile.role === "admin"}
            isPlatformAdmin={platformRole !== null}
            unreadCount={unreadCount ?? 0}
          />

          <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
            <span className="text-sm font-medium text-gray-600">
              {profile.full_name ?? ""}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      {/* Floating "Send Feedback" entry point — available on every dashboard page. */}
      <FeedbackButton />
    </div>
  );
}
