import { PDFDocument, degrees, rgb } from "pdf-lib";

export async function addWatermark(
  pdfBuffer: Buffer,
  text: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { height } = page.getSize();
    page.drawText(text, {
      x: 30,
      y: height - 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
      rotate: degrees(-15),
      opacity: 0.4,
    });
  }

  return Buffer.from(await pdf.save());
}
