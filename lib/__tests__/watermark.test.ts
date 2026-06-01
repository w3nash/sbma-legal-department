import { inflateSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  type PDFStream,
} from "pdf-lib";
import {
  addForensicWatermark,
  addViewerWatermark,
  addWatermark,
} from "@/lib/watermark";
import {
  WATERMARK_BRAND_NAME,
  WATERMARK_BRAND_SHORT,
} from "@/lib/watermark-config";

async function createBlankPdf(pageCount = 1): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([612, 792]);
  }
  return Buffer.from(await pdf.save());
}

function extractDrawnText(pdf: PDFDocument): string[] {
  const texts: string[] = [];

  for (const page of pdf.getPages()) {
    const contents = page.node.get(PDFName.of("Contents"));

    const streams: PDFStream[] =
      contents instanceof PDFArray
        ? contents
            .asArray()
            .map((entry) => pdf.context.lookup(entry))
            .filter((entry): entry is PDFRawStream => entry instanceof PDFRawStream)
        : contents instanceof PDFRawStream
          ? [contents]
          : [];

    for (const stream of streams) {
      const raw = Buffer.from(stream.getContents());
      const inflated = inflateSync(raw).toString("utf8");

      // pdf-lib encodes strings as <HEX> Tj
      const matches = inflated.match(/<([0-9A-F]+)>\s*Tj/g) ?? [];
      for (const match of matches) {
        const [, hex = ""] = match.match(/<([0-9A-F]+)>\s*Tj/) ?? [];
        if (!hex) continue;
        texts.push(Buffer.from(hex, "hex").toString("utf8"));
      }
    }
  }

  return texts;
}

describe("watermark", () => {
  it("adds viewer watermark with control number and SBMA branding", async () => {
    const original = await createBlankPdf();
    const watermarked = await addViewerWatermark(original, "CTRL-123");

    expect(watermarked.length).toBeGreaterThan(original.length);
    const loaded = await PDFDocument.load(watermarked);
    const drawn = extractDrawnText(loaded);
    expect(drawn).toContain("Control Number: CTRL-123");
    expect(drawn).toContain(WATERMARK_BRAND_SHORT);
    expect(drawn).toContain(WATERMARK_BRAND_NAME);
    expect(drawn.some((t) => t.includes("CONFIDENTIAL"))).toBe(true);
  });

  it("adds forensic watermark with user-specific details on every page", async () => {
    const original = await createBlankPdf(2);
    const watermarked = await addForensicWatermark(original, {
      controlNumber: "CTRL-456",
      copyNumber: 7,
      userName: "Taylor Test",
      userEmail: "taylor@example.com",
      timestamp: "2026-04-28T16:09:10+08:00",
    });

    expect(watermarked.length).toBeGreaterThan(original.length);
    const loaded = await PDFDocument.load(watermarked);
    const drawn = extractDrawnText(loaded);
    expect(drawn).toContain("Control Number: CTRL-456");
    expect(drawn).toContain("Copy Number: 7");
    expect(drawn).toContain("User: Taylor Test");
    expect(drawn).toContain("Email: taylor@example.com");
    expect(drawn).toContain("Timestamp: 2026-04-28T16:09:10+08:00");
    expect(drawn.some((t) => t.includes("CONFIDENTIAL"))).toBe(true);
  });

  it("supports legacy addWatermark with a plain single-line string", async () => {
    const original = await createBlankPdf();
    const watermarked = await addWatermark(
      original,
      "Draft - Internal review only"
    );
    const loaded = await PDFDocument.load(watermarked);
    const drawn = extractDrawnText(loaded);

    expect(drawn).toContain("Draft - Internal review only");
    expect(drawn.some((t) => t.startsWith("Copy Number:"))).toBe(false);
  });

  it("parses copy number from legacy forensic watermark lines", async () => {
    const original = await createBlankPdf();
    const watermarked = await addWatermark(original, [
      "Control Number: CTRL-999",
      "Copy Number: 12",
      "User: Jane",
      "Email: jane@example.com",
      "Timestamp: 2026-01-01T00:00:00+08:00",
    ]);
    const loaded = await PDFDocument.load(watermarked);
    const drawn = extractDrawnText(loaded);

    expect(drawn).toContain("Copy Number: 12");
  });

  it("preserves page count after watermarking", async () => {
    const original = await createBlankPdf(3);
    const watermarked = await addViewerWatermark(original, "CTRL-789");
    const loaded = await PDFDocument.load(watermarked);

    expect(loaded.getPageCount()).toBe(3);
  });
});
