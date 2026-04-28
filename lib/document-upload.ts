import path from "path";

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".rtf": "application/rtf",
};

export const SUPPORTED_FILE_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".rtf",
  ...Object.values(MIME_BY_EXTENSION),
].join(",");

const SUPPORTED_INPUT_MIMES = new Set(Object.values(MIME_BY_EXTENSION));
const UNTRUSTED_UPLOAD_MIMES = new Set(["", "application/octet-stream"]);

export function safeBasename(filename: string): string {
  const basename = path.basename(filename.replaceAll("\\", "/"));
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (sanitized === "." || sanitized === "..") return "upload";
  return sanitized || "upload";
}

export function getProcessedPdfFilename(filename: string): string {
  const normalized = filename.replaceAll("\\", "/");
  const ext = path.extname(normalized);
  const basename = path.basename(normalized, ext).trim();
  return `${basename || "document"}.pdf`;
}

export function assertPdfSize(buffer: Buffer, label: "Converted" | "Viewer") {
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`${label} PDF exceeds 50MB upload limit`);
  }
}

export function getSupportedMimeType(file: File): string {
  const normalizedMimeType = file.type.trim().toLowerCase();
  const extensionMimeType =
    MIME_BY_EXTENSION[path.extname(file.name).toLowerCase()];

  if (UNTRUSTED_UPLOAD_MIMES.has(normalizedMimeType) && extensionMimeType) {
    return extensionMimeType;
  }

  if (SUPPORTED_INPUT_MIMES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  throw new Error("Unsupported file type");
}
