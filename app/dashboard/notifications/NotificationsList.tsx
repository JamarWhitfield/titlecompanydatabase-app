"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/types/database";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/actions/notifications";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsList({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMarkRead(id: string) {
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleOpen(n: Notification) {
    if (!n.read_at) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        if (n.record_id) router.push(`/dashboard/records/${n.record_id}`);
        else router.refresh();
      });
      return;
    }
    if (n.record_id) router.push(`/dashboard/records/${n.record_id}`);
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Inbox
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {unreadCount} unread
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="font-medium text-gray-700">No notifications yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Save a search from the Shared Network and you&apos;ll be notified
            here when a newly shared record matches it.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  unread ? "bg-blue-50/40" : ""
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    unread ? "bg-blue-500" : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => handleOpen(n)}
                    disabled={isPending}
                    className="block text-left text-sm text-gray-800 hover:text-blue-700 disabled:opacity-50"
                  >
                    {n.message}
                  </button>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatTime(n.created_at)}
                  </p>
                </div>
                {unread && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    disabled={isPending}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
