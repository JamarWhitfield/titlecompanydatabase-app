// Shared display labels + accessible badge styles for the platform feedback
// dashboard. Values match the DB CHECK constraints (migration 0028). Each badge
// always shows its text label, so color is never the only indicator.

import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
} from "@/types/database";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  in_review: "In Review",
  in_progress: "In Progress",
  fixed: "Fixed",
  closed: "Closed",
  wont_fix: "Won't Fix",
  need_more_info: "Need More Info",
};

export const FEEDBACK_SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  feature_request: "Feature request",
  confusing_ux: "Confusing UX",
  data_import_issue: "Data/import issue",
  other: "Other",
};

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General",
  search_issue: "Search issue",
  upload_issue: "Upload issue",
  permission_issue: "Permission issue",
  file_download_issue: "File download issue",
  record_issue: "Record issue",
  network_sharing_issue: "Network sharing issue",
  data_import_issue: "Data/import issue",
  feature_request: "Feature request",
  confusing_ui: "Confusing UI",
  other: "Other",
};

// Ordered value lists for filter dropdowns.
export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  "open",
  "in_review",
  "in_progress",
  "fixed",
  "closed",
  "wont_fix",
  "need_more_info",
];

export const FEEDBACK_SEVERITY_ORDER: FeedbackSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const FEEDBACK_TYPE_ORDER: FeedbackType[] = [
  "bug",
  "feature_request",
  "confusing_ux",
  "data_import_issue",
  "other",
];

export const FEEDBACK_CATEGORY_ORDER: FeedbackCategory[] = [
  "general",
  "search_issue",
  "upload_issue",
  "permission_issue",
  "file_download_issue",
  "record_issue",
  "network_sharing_issue",
  "data_import_issue",
  "feature_request",
  "confusing_ui",
  "other",
];

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "in_review":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "fixed":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    case "closed":
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
    case "wont_fix":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "need_more_info":
      return "bg-purple-50 text-purple-700 ring-1 ring-purple-200";
    default:
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
  }
}

export function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "low":
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
    case "medium":
      return "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "critical":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
  }
}

export function statusLabel(status: string): string {
  return FEEDBACK_STATUS_LABELS[status as FeedbackStatus] ?? status;
}

export function severityLabel(severity: string): string {
  return FEEDBACK_SEVERITY_LABELS[severity as FeedbackSeverity] ?? severity;
}

export function typeLabel(type: string): string {
  return FEEDBACK_TYPE_LABELS[type as FeedbackType] ?? type;
}

export function categoryLabel(category: string): string {
  return FEEDBACK_CATEGORY_LABELS[category as FeedbackCategory] ?? category;
}
