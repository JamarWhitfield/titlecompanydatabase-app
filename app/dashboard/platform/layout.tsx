import { requirePlatformAdmin } from "@/lib/platform-auth";
import PlatformNav from "./PlatformNav";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side gate for the ENTIRE /dashboard/platform subtree. Non-platform
  // users are redirected before any child renders — the sidebar hiding in
  // NavLinks is cosmetic only; this is the real access control.
  const { role } = await requirePlatformAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Platform Console
          </h1>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
            {role}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Internal SaaS operations. Actions here are audited.
        </p>
      </div>

      <PlatformNav isOwner={role === "owner"} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
