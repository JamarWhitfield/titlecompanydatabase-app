"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/records", label: "My Records", exact: false },
  { href: "/dashboard/network", label: "Shared Network", exact: false },
];

export default function NavLinks({
  isAdmin = false,
  isPlatformAdmin = false,
  unreadCount = 0,
}: {
  isAdmin?: boolean;
  isPlatformAdmin?: boolean;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const navLinks = [
    ...links,
    { href: "/dashboard/notifications", label: "Notifications", exact: false },
    ...(isAdmin
      ? [
          { href: "/dashboard/team", label: "Team", exact: false },
          { href: "/dashboard/audit", label: "Audit Logs", exact: false },
        ]
      : []),
    { href: "/dashboard/settings", label: "Settings", exact: false },
    ...(isPlatformAdmin
      ? [{ href: "/dashboard/platform", label: "Platform", exact: false }]
      : []),
  ];
  return (
    <div className="flex gap-1 text-sm">
      {navLinks.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const showBadge =
          href === "/dashboard/notifications" && unreadCount > 0;
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-700"
                : "rounded-lg px-3 py-1.5 font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            }
          >
            <span className="inline-flex items-center gap-1.5">
              {label}
              {showBadge && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
