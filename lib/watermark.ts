import { PDFDocument, rgb } from "pdf-lib";

export async function addWatermark(
  pdfBuffer: Buffer,
  text: string | string[],
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();
  const lines = Array.isArray(text) ? text : [text];

  for (const page of pages) {
    const { height } = page.getSize();

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: 30,
        y: height - 30 - index * 14,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.4,
      });
    });
  }

  return Buffer.from(await pdf.save());
}
