import { PDFDocument } from "pdf-lib";

/**
 * Minimum bytes per page — PDFs below this threshold per page are likely
 * empty, corrupt, or over-compressed to the point of being unreadable.
 * A minimal blank PDF page with no content is ~400-600 bytes via pdf-lib;
 * real legal documents with text or scanned images are typically 50-500 KB/page.
 * 256 bytes is a conservative floor that catches truly degenerate output.
 */
export const MIN_BYTES_PER_PAGE = 256;

/**
 * Minimum page dimension in PDF points (1 point = 1/72 inch).
 * 72 points = 1 inch — anything smaller is degenerate and unusable.
 */
export const MIN_PAGE_WIDTH = 72;
export const MIN_PAGE_HEIGHT = 72;

/**
 * Maximum PDF size in bytes (50 MB). Mirrors the existing upload limit
 * from document-upload.ts to keep validation consistent.
 */
export const MAX_PDF_SIZE = 50 * 1024 * 1024;

export type PageInfo = {
  index: number;
  width: number;
  height: number;
};

export type ReadabilityReport = {
  valid: boolean;
  pageCount: number;
  totalSizeBytes: number;
  bytesPerPage: number;
  pages: PageInfo[];
  errors: string[];
  warnings: string[];
};

function createEmptyReport(
  totalSizeBytes: number,
  overrides?: Partial<ReadabilityReport>
): ReadabilityReport {
  return {
    valid: true,
    pageCount: 0,
    totalSizeBytes,
    bytesPerPage: 0,
    pages: [],
    errors: [],
    warnings: [],
    ...overrides,
  };
}

/**
 * Validates that the buffer is a parseable PDF document.
 * Returns null on success, or an error string on failure.
 */
export async function validatePdfStructure(
  buffer: Buffer
): Promise<string | null> {
  try {
    await PDFDocument.load(buffer, { ignoreEncryption: true });
    return null;
  } catch {
    return "PDF structure is invalid or the file is corrupt";
  }
}

/**
 * Validates that all pages have reasonable dimensions (at least 1 inch each).
 * Returns an array of error strings for any pages that fail.
 */
export function validatePageDimensions(pages: PageInfo[]): string[] {
  const errors: string[] = [];

  for (const page of pages) {
    if (page.width < MIN_PAGE_WIDTH || page.height < MIN_PAGE_HEIGHT) {
      errors.push(
        `Page ${page.index + 1} has invalid dimensions: ${page.width.toFixed(1)}×${page.height.toFixed(1)} pt (minimum ${MIN_PAGE_WIDTH}×${MIN_PAGE_HEIGHT} pt)`
      );
    }
  }

  return errors;
}

/**
 * Validates that the PDF has a minimum file size per page.
 * Returns an error string if the ratio is too low, null otherwise.
 */
export function validateMinimumSize(
  totalSizeBytes: number,
  pageCount: number
): string | null {
  if (pageCount === 0) return null; // Handled by page count check

  const bytesPerPage = totalSizeBytes / pageCount;

  if (bytesPerPage < MIN_BYTES_PER_PAGE) {
    return `PDF averages only ${Math.round(bytesPerPage)} bytes/page (minimum ${MIN_BYTES_PER_PAGE} bytes/page) — content may be empty or over-compressed`;
  }

  return null;
}

/**
 * Validates that the PDF has at least one page, and optionally
 * that it meets a minimum expected page count.
 */
export function validatePageCount(
  pageCount: number,
  expectedMinPages?: number
): string | null {
  if (pageCount === 0) {
    return "PDF has no pages";
  }

  if (expectedMinPages !== undefined && pageCount < expectedMinPages) {
    return `PDF has ${pageCount} page(s) but expected at least ${expectedMinPages}`;
  }

  return null;
}

/**
 * Validates that the PDF does not exceed the maximum allowed size.
 */
export function validateMaxSize(totalSizeBytes: number): string | null {
  if (totalSizeBytes > MAX_PDF_SIZE) {
    const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
    return `PDF size ${sizeMB} MB exceeds the ${MAX_PDF_SIZE / (1024 * 1024)} MB limit`;
  }

  return null;
}

export type ReadabilityOptions = {
  /** Descriptive label for log messages (e.g. "Post-conversion") */
  label?: string;
  /** Minimum expected page count */
  expectedMinPages?: number;
};

/**
 * Runs all readability validation checks on a PDF buffer and
 * returns a comprehensive report.
 *
 * This is the main entry point for readability validation.
 */
export async function validatePdfReadability(
  buffer: Buffer,
  opts?: ReadabilityOptions
): Promise<ReadabilityReport> {
  const totalSizeBytes = buffer.length;
  const label = opts?.label ?? "PDF";

  // Check 1: Structural integrity
  const structureError = await validatePdfStructure(buffer);
  if (structureError) {
    return createEmptyReport(totalSizeBytes, {
      valid: false,
      errors: [`${label}: ${structureError}`],
    });
  }

  // Parse the PDF for detailed checks
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pdfPages = pdf.getPages();
  const pageCount = pdfPages.length;
  const pages: PageInfo[] = pdfPages.map((page, index) => {
    const { width, height } = page.getSize();
    return { index, width, height };
  });
  const bytesPerPage = pageCount > 0 ? totalSizeBytes / pageCount : 0;

  const report: ReadabilityReport = {
    valid: true,
    pageCount,
    totalSizeBytes,
    bytesPerPage,
    pages,
    errors: [],
    warnings: [],
  };

  // Check 2: Page count
  const pageCountError = validatePageCount(pageCount, opts?.expectedMinPages);
  if (pageCountError) {
    report.errors.push(`${label}: ${pageCountError}`);
  }

  // Check 3: Page dimensions
  const dimensionErrors = validatePageDimensions(pages);
  for (const error of dimensionErrors) {
    report.errors.push(`${label}: ${error}`);
  }

  // Check 4: Minimum size per page
  const sizeError = validateMinimumSize(totalSizeBytes, pageCount);
  if (sizeError) {
    report.errors.push(`${label}: ${sizeError}`);
  }

  // Check 5: Maximum size
  const maxSizeError = validateMaxSize(totalSizeBytes);
  if (maxSizeError) {
    report.errors.push(`${label}: ${maxSizeError}`);
  }

  report.valid = report.errors.length === 0;
  return report;
}
