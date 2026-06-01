import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  MIN_BYTES_PER_PAGE,
  MIN_PAGE_HEIGHT,
  MIN_PAGE_WIDTH,
  MAX_PDF_SIZE,
  validatePdfStructure,
  validatePageDimensions,
  validateMinimumSize,
  validatePageCount,
  validateMaxSize,
  validatePdfReadability,
} from "@/lib/readability";

/** Helper: create a minimal valid PDF with the given number of pages and optional page size */
async function createTestPdf(
  pageCount: number,
  options?: { width?: number; height?: number; addText?: boolean }
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const width = options?.width ?? 612; // US Letter width
  const height = options?.height ?? 792; // US Letter height

  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([width, height]);

    if (options?.addText) {
      page.drawText(`Page ${i + 1} — Sample legal document content`, {
        x: 50,
        y: height - 50,
        size: 12,
      });
      page.drawText(
        "This is representative text content for readability validation.",
        { x: 50, y: height - 70, size: 10 }
      );
    }
  }

  return Buffer.from(await pdf.save());
}

// ---------------------------------------------------------------------------
// Unit tests for individual validation functions
// ---------------------------------------------------------------------------

describe("validatePdfStructure", () => {
  it("returns null for a valid PDF", async () => {
    const pdf = await createTestPdf(1);
    expect(await validatePdfStructure(pdf)).toBeNull();
  });

  it("returns an error for a corrupt buffer", async () => {
    const corrupt = Buffer.from("this is definitely not a PDF");
    const result = await validatePdfStructure(corrupt);
    expect(result).toContain("invalid");
  });

  it("returns an error for an empty buffer", async () => {
    const result = await validatePdfStructure(Buffer.alloc(0));
    expect(result).toContain("invalid");
  });
});

describe("validatePageDimensions", () => {
  it("returns no errors for standard US Letter pages", () => {
    const pages = [
      { index: 0, width: 612, height: 792 },
      { index: 1, width: 612, height: 792 },
    ];
    expect(validatePageDimensions(pages)).toEqual([]);
  });

  it("returns no errors for A4 pages", () => {
    const pages = [{ index: 0, width: 595.28, height: 841.89 }];
    expect(validatePageDimensions(pages)).toEqual([]);
  });

  it("returns errors for pages smaller than 1 inch", () => {
    const pages = [
      { index: 0, width: 50, height: 50 },
      { index: 1, width: 612, height: 792 },
    ];
    const errors = validatePageDimensions(pages);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Page 1");
    expect(errors[0]).toContain("invalid dimensions");
  });

  it("returns errors when width is too small but height is fine", () => {
    const pages = [{ index: 0, width: 10, height: 792 }];
    const errors = validatePageDimensions(pages);
    expect(errors).toHaveLength(1);
  });

  it("returns errors when height is too small but width is fine", () => {
    const pages = [{ index: 0, width: 612, height: 10 }];
    const errors = validatePageDimensions(pages);
    expect(errors).toHaveLength(1);
  });

  it("flags multiple invalid pages", () => {
    const pages = [
      { index: 0, width: 10, height: 10 },
      { index: 1, width: 20, height: 20 },
      { index: 2, width: 612, height: 792 },
    ];
    const errors = validatePageDimensions(pages);
    expect(errors).toHaveLength(2);
  });
});

describe("validateMinimumSize", () => {
  it("returns null when size per page is adequate", () => {
    expect(validateMinimumSize(10_000, 2)).toBeNull(); // 5000 bytes/page
  });

  it("returns an error when size per page is too low", () => {
    const result = validateMinimumSize(500, 2); // 250 bytes/page
    expect(result).toContain("bytes/page");
    expect(result).toContain("over-compressed");
  });

  it("returns null for zero pages (deferred to page count check)", () => {
    expect(validateMinimumSize(1000, 0)).toBeNull();
  });
});

describe("validatePageCount", () => {
  it("returns null for a non-empty PDF", () => {
    expect(validatePageCount(5)).toBeNull();
  });

  it("returns an error for zero pages", () => {
    const result = validatePageCount(0);
    expect(result).toContain("no pages");
  });

  it("returns an error when page count is below expected minimum", () => {
    const result = validatePageCount(2, 5);
    expect(result).toContain("expected at least 5");
  });

  it("returns null when page count meets expected minimum", () => {
    expect(validatePageCount(5, 5)).toBeNull();
    expect(validatePageCount(10, 5)).toBeNull();
  });
});

describe("validateMaxSize", () => {
  it("returns null for a normal-sized PDF", () => {
    expect(validateMaxSize(1_000_000)).toBeNull(); // 1 MB
  });

  it("returns an error when PDF exceeds the 50 MB limit", () => {
    const result = validateMaxSize(MAX_PDF_SIZE + 1);
    expect(result).toContain("exceeds");
    expect(result).toContain("50");
  });
});

// ---------------------------------------------------------------------------
// Integration tests for the orchestrator
// ---------------------------------------------------------------------------

describe("validatePdfReadability", () => {
  it("passes a valid single-page PDF", async () => {
    const pdf = await createTestPdf(1, { addText: true });
    const report = await validatePdfReadability(pdf);

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(1);
    expect(report.totalSizeBytes).toBeGreaterThan(0);
    expect(report.bytesPerPage).toBeGreaterThan(0);
    expect(report.pages).toHaveLength(1);
    expect(report.errors).toEqual([]);
  });

  it("passes a valid multi-page legal document (10 pages)", async () => {
    const pdf = await createTestPdf(10, { addText: true });
    const report = await validatePdfReadability(pdf);

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(10);
    expect(report.pages).toHaveLength(10);
    expect(report.errors).toEqual([]);
  });

  it("passes a standard US Letter PDF with minimal text", async () => {
    const pdf = await createTestPdf(3, { addText: true });
    const report = await validatePdfReadability(pdf);

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(3);
  });

  it("rejects a corrupt / non-PDF buffer", async () => {
    const corrupt = Buffer.from("Not a PDF file at all");
    const report = await validatePdfReadability(corrupt, {
      label: "Corrupt-test",
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("Corrupt-test");
    expect(report.errors[0]).toContain("invalid");
  });



  it("rejects a PDF with tiny page dimensions", async () => {
    const pdf = await createTestPdf(1, { width: 10, height: 10 });
    const report = await validatePdfReadability(pdf, {
      label: "Tiny-dims",
    });

    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("invalid dimensions"))).toBe(
      true
    );
  });

  it("uses the label in error messages", async () => {
    const pdf = await createTestPdf(1, { width: 10, height: 10 });
    const report = await validatePdfReadability(pdf, {
      label: "Post-conversion",
    });

    expect(report.errors[0]).toContain("Post-conversion");
  });

  it("validates page count against an expected minimum", async () => {
    const pdf = await createTestPdf(2);
    const report = await validatePdfReadability(pdf, {
      expectedMinPages: 5,
    });

    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("expected at least 5"))).toBe(
      true
    );
  });

  it("passes when page count meets the expected minimum", async () => {
    const pdf = await createTestPdf(5, { addText: true });
    const report = await validatePdfReadability(pdf, {
      expectedMinPages: 3,
    });

    expect(report.valid).toBe(true);
  });

  it("preserves page dimension details in the report", async () => {
    const pdf = await createTestPdf(2, { width: 595, height: 842 }); // A4ish
    const report = await validatePdfReadability(pdf);

    expect(report.pages[0]?.width).toBeCloseTo(595, 0);
    expect(report.pages[0]?.height).toBeCloseTo(842, 0);
    expect(report.pages[1]?.width).toBeCloseTo(595, 0);
  });

  it("reports correct bytesPerPage", async () => {
    const pdf = await createTestPdf(4);
    const report = await validatePdfReadability(pdf);

    expect(report.bytesPerPage).toBeCloseTo(
      report.totalSizeBytes / 4,
      0
    );
  });

  it("validates a watermarked PDF still passes readability", async () => {
    // Simulate what the pipeline does: create PDF, then watermark
    const { addViewerWatermark } = await import("@/lib/watermark");

    const pdf = await createTestPdf(2, { addText: true });
    const watermarked = await addViewerWatermark(
      pdf,
      "TEST-001"
    );
    const report = await validatePdfReadability(watermarked, {
      label: "Post-watermark",
    });

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(2);
  });

  it("validates a round-trip: create → validate → watermark → validate", async () => {
    const { addViewerWatermark } = await import("@/lib/watermark");

    // Step 1: Create and validate
    const pdf = await createTestPdf(3, { addText: true });
    const preReport = await validatePdfReadability(pdf, {
      label: "Post-conversion",
    });
    expect(preReport.valid).toBe(true);

    // Step 2: Watermark and validate again
    const watermarked = await addViewerWatermark(
      pdf,
      "ROUND-TRIP"
    );
    const postReport = await validatePdfReadability(watermarked, {
      label: "Post-watermark",
    });
    expect(postReport.valid).toBe(true);

    // Page count should be preserved
    expect(postReport.pageCount).toBe(preReport.pageCount);
  });

  it("collects multiple errors when several checks fail", async () => {
    // Create a PDF with tiny dimensions (fails dimension check)
    // and no text (fails bytesPerPage check)
    const pdf = await createTestPdf(3, { width: 10, height: 10 });
    const report = await validatePdfReadability(pdf);

    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Threshold constant tests (ensures they're exported and reasonable)
// ---------------------------------------------------------------------------

describe("readability constants", () => {
  it("MIN_BYTES_PER_PAGE is 256", () => {
    expect(MIN_BYTES_PER_PAGE).toBe(256);
  });

  it("MIN_PAGE_WIDTH is 72 (1 inch)", () => {
    expect(MIN_PAGE_WIDTH).toBe(72);
  });

  it("MIN_PAGE_HEIGHT is 72 (1 inch)", () => {
    expect(MIN_PAGE_HEIGHT).toBe(72);
  });

  it("MAX_PDF_SIZE is 50 MB", () => {
    expect(MAX_PDF_SIZE).toBe(50 * 1024 * 1024);
  });
});
