import { inflateSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { addWatermark } from "@/lib/watermark";
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

function extractDrawnText(pdf: PDFDocument): string[] {
  const contents = pdf.getPages()[0]?.node.get(PDFName.of("Contents"));
  const stream =
    contents instanceof PDFArray
      ? contents
          .asArray()
          .map((entry) => pdf.context.lookup(entry))
          .find((entry): entry is PDFRawStream => entry instanceof PDFRawStream)
      : contents instanceof PDFRawStream
        ? contents
        : undefined;

  return stream
    ? inflateSync(Buffer.from(stream.getContents()))
        .toString("utf8")
        .match(/<([0-9A-F]+)> Tj/g)
        ?.map((entry: string) => {
          const [, hex = ""] = entry.match(/<([0-9A-F]+)> Tj/) ?? [];
          return Buffer.from(hex, "hex").toString("utf8");
        }) ?? []
    : [];
}

describe("watermark", () => {
  it("adds each watermark line as a separate text row", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 400]);
    const original = await pdf.save();

    const lines = [
      "Control Number: CTRL-123",
      "Copy Number: 7",
      "User: John",
    ];
    const watermarked = await addWatermark(Buffer.from(original), lines);
    const loaded = await PDFDocument.load(watermarked);

    expect(watermarked.length).toBeGreaterThan(0);
    expect(extractDrawnText(loaded)).toEqual(lines);
  });

  it("still supports a single watermark string", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 400]);
    const original = await pdf.save();

    const watermarked = await addWatermark(
      Buffer.from(original),
      "Control Number: CTRL-123"
    );

    expect(watermarked.length).toBeGreaterThan(0);
  });
});
