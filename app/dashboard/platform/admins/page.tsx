import { requirePlatformOwner } from "@/lib/platform-auth";
import { createClient } from "@/lib/supabase/server";
import PlatformAdminsManager from "./PlatformAdminsManager";

export default async function PlatformAdminsPage() {
  const { userId } = await requirePlatformOwner();

  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_list_admins");

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Platform admins
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Platform admins are internal operators, separate from company admins.
        Manage access carefully — every change here is audited.
      </p>
      <PlatformAdminsManager admins={data ?? []} currentUserId={userId} />
    </div>
  );
}
