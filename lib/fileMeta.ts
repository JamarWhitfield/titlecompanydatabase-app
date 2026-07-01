// Shared helpers for displaying attachment metadata consistently across
// My Records, the edit modal, and the Shared Network. Pure formatting — no
// data access, safe to import from any client or server component.

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Short, human-friendly label for a file's type (e.g. "PDF", "PNG", "Word").
export function fileTypeLabel(mime: string | null | undefined, name: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf") return "PDF";
  if (m.startsWith("image/")) return m.slice(6).toUpperCase();
  if (m.startsWith("text/")) return "Text";
  if (m.includes("word") || /\.docx?$/i.test(name)) return "Word";
  if (m.includes("sheet") || m.includes("excel") || /\.xlsx?$/i.test(name)) return "Excel";
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "";
  return ext && ext.length <= 5 ? ext : "File";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
