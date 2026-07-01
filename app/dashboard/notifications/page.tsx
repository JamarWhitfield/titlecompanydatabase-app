import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Notification, SavedSearch } from "@/types/database";
import NotificationsList from "./NotificationsList";
import SavedSearches from "./SavedSearches";

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // RLS scopes both queries to the caller's company.
  const [{ data: notifs }, { data: searches }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const notifications = (notifs as Notification[]) ?? [];
  const savedSearches = (searches as SavedSearch[]) ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re notified when a newly shared network record matches one of
          your saved searches.
        </p>
      </div>

      <SavedSearches searches={savedSearches} />

      <NotificationsList
        notifications={notifications}
        unreadCount={unreadCount}
      />
    </div>
  );
}
