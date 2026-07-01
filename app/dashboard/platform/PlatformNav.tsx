"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PlatformNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/platform", label: "Overview", exact: true },
    { href: "/dashboard/platform/companies", label: "Companies", exact: false },
    { href: "/dashboard/platform/support", label: "Support", exact: false },
    { href: "/dashboard/platform/audit", label: "Platform Audit", exact: false },
    ...(isOwner
      ? [
          { href: "/dashboard/platform/usage", label: "Usage", exact: false },
          { href: "/dashboard/platform/admins", label: "Admins", exact: false },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 text-sm">
      {tabs.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "-mb-px border-b-2 border-purple-600 px-3 py-2 font-semibold text-purple-700"
                : "-mb-px border-b-2 border-transparent px-3 py-2 font-medium text-gray-500 transition-colors hover:text-gray-800"
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
