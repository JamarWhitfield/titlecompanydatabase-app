import { createClient } from "@/lib/supabase/server";
import type { FeedbackListItem } from "@/types/database";
import FeedbackList from "./FeedbackList";

// Authorization is enforced server-side by the /dashboard/platform layout
// (requirePlatformAdmin) AND by the platform_list_feedback RPC, which raises
// unless the caller is a platform admin. Normal users can never reach here.
export default async function PlatformFeedbackPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_list_feedback");

  const reports = (error ? [] : (data ?? [])) as FeedbackListItem[];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Feedback Reports</h2>
        <p className="mt-1 text-sm text-gray-500">
          Review bug reports, feature requests, confusing workflows, and
          data/import issues submitted by pilot customers.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load feedback reports. Please try again.
        </p>
      ) : (
        <FeedbackList reports={reports} />
      )}
    </div>
  );
}
