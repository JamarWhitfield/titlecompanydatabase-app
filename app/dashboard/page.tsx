import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const profile = await getProfile();
  const company = profile?.companies;

  const supabase = await createClient();
  const [
    { count: totalCount },
    { count: sharedByUs },
    { count: networkCount },
  ] = await Promise.all([
    supabase
      .from("company_records")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("company_records")
      .select("*", { count: "exact", head: true })
      .eq("is_shared", true),
    supabase
      .from("shared_records_network")
      .select("*", { count: "exact", head: true }),
  ]);

  const privateCount = (totalCount ?? 0) - (sharedByUs ?? 0);

  const stats = [
    {
      label: "My Records",
      value: totalCount ?? 0,
      description: "Total records in your database",
      href: "/dashboard/records",
      dot: "bg-blue-500",
    },
    {
      label: "Shared by Us",
      value: sharedByUs ?? 0,
      description: "Records visible to the network",
      href: "/dashboard/records",
      dot: "bg-green-500",
    },
    {
      label: "Private",
      value: privateCount,
      description: "Records only your company can see",
      href: "/dashboard/records",
      dot: "bg-gray-400",
    },
    {
      label: "On Network",
      value: networkCount ?? 0,
      description: "Total shared records across all companies",
      href: "/dashboard/network",
      dot: "bg-indigo-500",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-gray-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        {company && (
          <p className="text-sm text-gray-500">{company.name}</p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${stat.dot}`} />
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/records"
          className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
              <path d="M14 4v5h5" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 font-semibold text-gray-900">
              My Records
              <span className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500">
                &rarr;
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your company&apos;s private title records and decide what to
              share.
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/network"
          className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 font-semibold text-gray-900">
              Shared Network
              <span className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500">
                &rarr;
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search records shared by participating title companies.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
