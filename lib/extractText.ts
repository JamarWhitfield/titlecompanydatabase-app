import "server-only";

// Extracts plain text from an uploaded file so its contents can be indexed
// for full-text search. Best-effort: any failure returns "" so a bad/unknown
// file never blocks the upload — the record stays searchable by its metadata.
//
// Supported:
//   - PDFs with selectable text   → parsed with unpdf (fast, accurate)
//   - Word documents (.docx)      → parsed with mammoth (raw text)
//   - Images / scanned documents  → OCR'd with tesseract.js (slower)
//   - Plain-text formats          → read directly
//
// Note: image-only ("scanned") PDFs have no selectable text, so unpdf returns
// little or nothing for them. Rasterising PDF pages to images for OCR needs a
// heavier pipeline (and is better run as a background job), so it is not done
// here — upload a page image directly if you need OCR of a scanned page.

const MAX_TEXT = 1_000_000; // cap stored text at ~1 MB

function clamp(text: string): string {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > MAX_TEXT ? normalized.slice(0, MAX_TEXT) : normalized;
}

function hasExt(name: string, exts: RegExp): boolean {
  return exts.test(name.toLowerCase());
}

async function extractPdfText(file: File): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return clamp(Array.isArray(text) ? text.join("\n") : text);
}

async function extractDocxText(file: File): Promise<string> {
  // mammoth pulls the raw text out of the .docx XML (ignores styling).
  const mammoth = (await import("mammoth")).default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { value } = await mammoth.extractRawText({ buffer });
  return clamp(value);
}

async function ocrImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data } = await worker.recognize(buffer);
    return clamp(data.text);
  } finally {
    await worker.terminate();
  }
}

export async function extractFileText(file: File): Promise<string> {
  const mime = file.type || "";
  const name = file.name || "";

  try {
    if (mime === "application/pdf" || hasExt(name, /\.pdf$/)) {
      return await extractPdfText(file);
    }
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      hasExt(name, /\.docx$/)
    ) {
      return await extractDocxText(file);
    }
    if (mime.startsWith("image/") || hasExt(name, /\.(png|jpe?g|tiff?|bmp|webp|gif)$/)) {
      return await ocrImage(file);
    }
    if (mime.startsWith("text/") || hasExt(name, /\.(txt|csv|md|markdown|json|html?|xml)$/)) {
      return clamp(await file.text());
    }
    return ""; // unsupported binary type — searchable by metadata only
  } catch (err) {
    console.error(
      "Text extraction failed for",
      name,
      err instanceof Error ? err.message : err
    );
    return "";
  }
}
