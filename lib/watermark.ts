import fs from "fs/promises";
import {
  degrees,
  PDFDocument,
  PDFImage,
  type PDFPage,
  rgb,
} from "pdf-lib";
import {
  getWatermarkSealConfig,
  WATERMARK_BRAND_NAME,
  WATERMARK_BRAND_SHORT,
} from "@/lib/watermark-config";

export type ForensicWatermarkDetails = {
  controlNumber: string;
  copyNumber: number;
  userName: string;
  userEmail: string;
  timestamp: string;
};

const BACKGROUND_TEXT_SIZE = 26;
const BACKGROUND_OPACITY = 0.09;
const BACKGROUND_COLOR = rgb(0.72, 0.72, 0.72);
const FOOTER_TEXT_COLOR = rgb(0.35, 0.35, 0.35);
const FOOTER_BRAND_COLOR = rgb(0.5, 0.5, 0.5);
const SEAL_OPACITY = 0.07;

/** Loads the configured SBMA seal image when seal usage is enabled. */
async function loadSealImage(pdf: PDFDocument): Promise<PDFImage | null> {
  const sealConfig = getWatermarkSealConfig();
  if (!sealConfig.enabled || !sealConfig.path) {
    return null;
  }

  try {
    const bytes = await fs.readFile(sealConfig.path);
    if (sealConfig.path.toLowerCase().endsWith(".png")) {
      return pdf.embedPng(bytes);
    }
    return pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** Draws repeating diagonal SBMA branding across the page background. */
function drawDiagonalBackground(page: PDFPage, width: number, height: number) {
  const stepX = 280;
  const stepY = 190;
  const rows = Math.ceil(height / stepY) + 2;
  const cols = Math.ceil(width / stepX) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      page.drawText(WATERMARK_BRAND_NAME, {
        x: col * stepX - 40,
        y: row * stepY + 80,
        size: BACKGROUND_TEXT_SIZE,
        color: BACKGROUND_COLOR,
        opacity: BACKGROUND_OPACITY,
        rotate: degrees(45),
      });
    }
  }
}

/** Draws the SBMA seal in the top-left corner at low opacity. */
function drawLogoTopLeft(page: PDFPage, width: number, height: number, seal: PDFImage) {
  const margin = 22;
  const logoSize = Math.min(width, height) * 0.11;

  page.drawImage(seal, {
    x: margin,
    y: height - margin - logoSize,
    width: logoSize,
    height: logoSize,
    opacity: SEAL_OPACITY,
  });
}

/** Draws watermark metadata lines in the top-left header block. */
function drawTopLeftTextBlock(
  page: PDFPage,
  width: number,
  height: number,
  lines: string[],
  brandLabel = WATERMARK_BRAND_SHORT,
  hasLogo = false
) {
  const margin = 22;
  const lineHeight = 11;
  const topPadding = 26;
  const logoSize = Math.min(width, height) * 0.11;
  const blockX = hasLogo ? margin + logoSize + 10 : margin;

  // Draw from top down (first line closest to top)
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: blockX,
      y: height - topPadding - index * lineHeight,
      size: 8,
      color: FOOTER_TEXT_COLOR,
      opacity: 0.85,
    });
  });

  page.drawText(brandLabel, {
    x: Math.max(margin, width - 160),
    y: height - topPadding,
    size: 7,
    color: FOOTER_BRAND_COLOR,
    opacity: 0.65,
  });
}

function drawForensicBanner(page: PDFPage, width: number, height: number) {
  // Intentionally removed. Stakeholders requested no large "AUTHORIZED COPY" banner.
}

/** Builds footer lines for download/print forensic watermarks. */
function buildForensicFooterLines(details: ForensicWatermarkDetails): string[] {
  return [
    `Control Number: ${details.controlNumber}`,
    `Copy Number: ${details.copyNumber}`,
    `User: ${details.userName}`,
    `Email: ${details.userEmail}`,
    `Timestamp: ${details.timestamp}`,
    "CONFIDENTIAL — Authorized copy only. Do not distribute.",
  ];
}

/** Parses copy number from legacy watermark lines; returns 0 when missing or non-numeric. */
function parseCopyNumberFromLines(lines: string[]): number {
  const parsed = Number.parseInt(
    lines
      .find((line) => line.startsWith("Copy Number:"))
      ?.replace(/^Copy Number:\s*/, "") ?? "0",
    10
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Builds header lines for in-app viewer watermarks. */
function buildViewerHeaderLines(controlNumber: string): string[] {
  return [
    `Control Number: ${controlNumber}`,
    "CONFIDENTIAL — Viewer copy. Do not distribute.",
  ];
}

/** Applies background branding, optional seal, and header text to one PDF page. */
async function applyPageWatermark(
  page: PDFPage,
  options: {
    footerLines: string[];
    style: "viewer" | "forensic";
    seal: PDFImage | null;
  }
) {
  const { width, height } = page.getSize();

  drawDiagonalBackground(page, width, height);

  const hasLogo = Boolean(options.seal);
  if (options.seal) {
    drawLogoTopLeft(page, width, height, options.seal);
  }

  if (options.style === "forensic") {
    // No large banner watermark for forensic copies.
  }

  drawTopLeftTextBlock(
    page,
    width,
    height,
    options.footerLines,
    WATERMARK_BRAND_SHORT,
    hasLogo
  );
}

/** Applies the selected watermark style to every page in a PDF buffer. */
async function watermarkPdf(
  pdfBuffer: Buffer,
  options: {
    style: "viewer" | "forensic";
    footerLines: string[];
  }
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const seal = await loadSealImage(pdf);
  const pages = pdf.getPages();

  for (const page of pages) {
    await applyPageWatermark(page, {
      style: options.style,
      footerLines: options.footerLines,
      seal,
    });
  }

  return Buffer.from(await pdf.save());
}

/**
 * Applies a legal-office viewer watermark: light diagonal SBMA branding,
 * optional approved seal, and a control-number footer on every page.
 */
export async function addViewerWatermark(
  pdfBuffer: Buffer,
  controlNumber: string
): Promise<Buffer> {
  return watermarkPdf(pdfBuffer, {
    style: "viewer",
    footerLines: buildViewerHeaderLines(controlNumber),
  });
}

/**
 * Applies a forensic download/print watermark with user-specific details
 * in the footer plus non-destructive background branding.
 */
export async function addForensicWatermark(
  pdfBuffer: Buffer,
  details: ForensicWatermarkDetails
): Promise<Buffer> {
  return watermarkPdf(pdfBuffer, {
    style: "forensic",
    footerLines: buildForensicFooterLines(details),
  });
}

/**
 * @deprecated Use addForensicWatermark for downloads or addViewerWatermark for viewer copies.
 */
export async function addWatermark(
  pdfBuffer: Buffer,
  text: string | string[]
): Promise<Buffer> {
  const lines = Array.isArray(text) ? text : [text];

  if (lines.length === 1) {
    const line = lines[0] ?? "";
    if (line.startsWith("Control Number:")) {
      return addViewerWatermark(
        pdfBuffer,
        line.replace(/^Control Number:\s*/, "")
      );
    }
    return watermarkPdf(pdfBuffer, {
      style: "viewer",
      footerLines: [line],
    });
  }

  const controlLine =
    lines.find((line) => line.startsWith("Control Number:")) ??
    "Control Number: unknown";

  const details: ForensicWatermarkDetails = {
    controlNumber:
      controlLine.replace(/^Control Number:\s*/, "") || "unknown",
    copyNumber: parseCopyNumberFromLines(lines),
    userName:
      lines
        .find((line) => line.startsWith("User:"))
        ?.replace(/^User:\s*/, "") ?? "Unknown User",
    userEmail:
      lines
        .find((line) => line.startsWith("Email:"))
        ?.replace(/^Email:\s*/, "") ?? "unknown",
    timestamp:
      lines
        .find((line) => line.startsWith("Timestamp:"))
        ?.replace(/^Timestamp:\s*/, "") ?? new Date().toISOString(),
  };

  return addForensicWatermark(pdfBuffer, details);
}