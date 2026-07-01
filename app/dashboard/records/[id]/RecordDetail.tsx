"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteRecord, toggleShare } from "@/app/actions/records";
import { deleteFile, getSignedUrl } from "@/app/actions/files";
import { formatBytes, fileTypeLabel, formatDate } from "@/lib/fileMeta";
import RecordFormModal from "../RecordFormModal";
import RecordNotes, { type NoteView } from "./RecordNotes";
import type { CompanyRecord, RecordFile } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  abstract: "Abstract",
  qualia_file: "Qualia File",
};

const TYPE_COLORS: Record<string, string> = {
  abstract: "bg-indigo-100 text-indigo-700",
  qualia_file: "bg-teal-100 text-teal-700",
  general: "bg-gray-100 text-gray-600",
};

// Friendly labels + dot colors for the activity timeline.
const AUDIT_META: Record<string, { label: string; dot: string }> = {
  INSERT: { label: "Created", dot: "bg-green-500" },
  UPDATE: { label: "Edited", dot: "bg-blue-500" },
  SHARE: { label: "Shared", dot: "bg-teal-500" },
  UNSHARE: { label: "Unshared", dot: "bg-amber-500" },
  DELETE: { label: "Deleted", dot: "bg-red-500" },
  ATTACHMENT_UPLOADED: { label: "Attachment uploaded", dot: "bg-indigo-500" },
  ATTACHMENT_DELETED: { label: "Attachment removed", dot: "bg-rose-500" },
};

function auditMeta(action: string) {
  return (
    AUDIT_META[action] ?? {
      label: action
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
      dot: "bg-gray-400",
    }
  );
}

function formatEventTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface AuditEvent {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  detail: string | null;
}

interface Props {
  record: CompanyRecord;
  companyName: string;
  files: RecordFile[];
  isOwn: boolean;
  auditTrail: AuditEvent[];
  notes: NoteView[];
  currentUserId: string;
  isAdmin: boolean;
}

export default function RecordDetail({
  record,
  companyName,
  files,
  isOwn,
  auditTrail,
  notes,
  currentUserId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  function handleToggleShare() {
    const msg = record.is_shared
      ? `Remove "${record.title}" from the shared network? Other companies will no longer see it.`
      : `Share "${record.title}" with all companies in the network? They can view but not edit it.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = await toggleShare(record.id, record.is_shared);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${record.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteRecord(record.id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.push("/dashboard/records");
    });
  }

  function handleDownload(file: RecordFile) {
    startTransition(async () => {
      const result = await getSignedUrl(file.path);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.url) window.open(result.url, "_blank");
    });
  }

  function handleRemoveFile(file: RecordFile) {
    if (!confirm(`Remove "${file.name}" from this record? This cannot be undone.`))
      return;
    startTransition(async () => {
      const result = await deleteFile(file.id, file.path);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  const typeColor = TYPE_COLORS[record.record_type] ?? TYPE_COLORS.general;
  const typeLabel = TYPE_LABELS[record.record_type] ?? record.record_type;
  const location = [record.county, record.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard/records"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        &larr; Back to My Records
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {record.title}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}
            >
              {typeLabel}
            </span>
            {record.is_shared ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Shared
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                Private
              </span>
            )}
            {!isOwn && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Read-only
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{companyName}</p>
        </div>

        {isOwn && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              disabled={isPending}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={handleToggleShare}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${
                record.is_shared
                  ? "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {record.is_shared ? "Unshare" : "Share"}
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Record type
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">{typeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Sharing status
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {record.is_shared ? "Shared to network" : "Private"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Owner
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {companyName}
              {isOwn ? " (your company)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Property / location
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">{location || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Created
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {formatDate(record.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Last updated
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {formatDate(record.updated_at)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Description / notes
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
              {record.description || "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Attachments */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Attachments{" "}
            <span className="font-normal text-gray-400">({files.length})</span>
          </h2>
        </div>

        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-500">
              {isOwn
                ? "No attachments yet. Use Edit to upload PDFs, images, or documents and make this record easier to search."
                : "No attachments on this record."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                  {file.name}
                </span>
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  {fileTypeLabel(file.mime_type, file.name)}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatBytes(file.size)}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatDate(file.created_at)}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    file.indexed
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  title={
                    file.indexed
                      ? "Text was extracted and is searchable"
                      : "No searchable text was extracted from this file"
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      file.indexed ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  {file.indexed ? "Indexed for search" : "No text extracted"}
                </span>
                <div className="ml-auto flex shrink-0 gap-3 text-xs">
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={isPending}
                    className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Download
                  </button>
                  {isOwn && (
                    <button
                      onClick={() => handleRemoveFile(file)}
                      disabled={isPending}
                      className="font-medium text-red-500 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity / audit trail */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Activity</h2>

        {auditTrail.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-500">
              No activity recorded yet for this record.
            </p>
          </div>
        ) : (
          <ol className="relative ml-1 border-l border-gray-200">
            {auditTrail.map((event) => {
              const meta = auditMeta(event.action);
              const who = event.actorName ?? "Unknown user";
              return (
                <li key={event.id} className="mb-4 ml-4 last:mb-0">
                  <span
                    className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${meta.dot}`}
                  />
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{meta.label}</span> by {who}
                    {event.detail ? (
                      <span className="text-gray-500"> · {event.detail}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatEventTime(event.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <RecordNotes
        recordId={record.id}
        notes={notes}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />

      {isOwn && (
        <RecordFormModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            // Pick up any edits (fields or attachments) made in the modal.
            router.refresh();
          }}
          record={record}
          files={files}
        />
      )}
    </div>
  );
}
