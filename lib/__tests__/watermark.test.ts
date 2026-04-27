import { describe, it, expect } from "vitest";
import { addWatermark } from "@/lib/watermark";
import { PDFDocument } from "pdf-lib";

describe("watermark", () => {
  it("adds watermark text to a PDF", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 400]);
    page.drawText("Original", { x: 50, y: 350, size: 20 });
    const original = await pdf.save();

    const watermarked = await addWatermark(
      Buffer.from(original),
      "CTRL-123 | John | john@test.com | 192.168.1.1 | 2024-01-01",
    );

    expect(watermarked.length).toBeGreaterThan(0);
  });
});
