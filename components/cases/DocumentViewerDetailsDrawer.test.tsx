import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";
import type { DocumentDetailData } from "@/lib/document-detail";
import { DocumentViewerDetailsDrawer } from "./DocumentViewerDetailsDrawer";

const readyDocument = {
  id: "doc-1",
  caseId: "case-1",
  controlNumber: "CTRL-001",
  downloadCount: 7,
  originalFilename: "Pleading.pdf",
  fileSizeBytes: "1024",
  mimeType: "application/pdf",
  processingError: null,
  status: DocumentStatus.ready,
  createdAt: "2026-04-28T00:00:00.000Z",
  viewerAvailable: true,
  downloadAvailable: true,
} satisfies DocumentDetailData;

function renderDrawer(data: DocumentDetailData = readyDocument): string {
  return renderToStaticMarkup(
    <DocumentViewerDetailsDrawer data={data} onClose={vi.fn()} />
  );
}

describe("DocumentViewerDetailsDrawer", () => {
  it("renders an animated icon-led metadata inspector", () => {
    const html = renderDrawer();

    expect(html).toContain("Document details");
    expect(html).toContain("Pleading.pdf");
    expect(html).toContain("CTRL-001");
    expect(html).toContain("April 28, 2026");
    expect(html).toContain("1 KB");
    expect(html).toContain("application/pdf");
    expect(html).toContain("7");
    expect(html).toContain("This viewer copy is ready for inline viewing.");
    expect(html).toContain('aria-labelledby="document-details-heading"');
    expect(html).toContain('id="document-details-heading"');
    expect(html).toContain('aria-label="Close document details"');
    expect(html).toContain('title="Close document details"');
    expect(html).toContain("h-full");
    expect(html).toContain("shrink-0");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("border-l");
    expect(html).toContain("absolute");
    expect(html).toContain("right-0");
    expect(html).toContain("z-20");
    expect(html).toContain("max-w-sm");
    expect(html).toContain("sm:w-80");
    expect(html).toContain("md:static");
    expect(html).toContain("md:z-auto");
    expect(html).toContain("md:w-80");
    expect(html).toContain("animate-in");
    expect(html).toContain("fade-in");
    expect(html).toContain("slide-in-from-right-3");
    expect(html).toContain("duration-200");
    expect(html).toContain("fill-mode-both");
    expect(html).toContain("bg-[#181b20]");
    expect(html).toContain("text-white");
    expect(html).toContain("border-white/10");
    expect(html).toContain("bg-white/5");
    expect(html).toContain("ring-white/10");
    expect(html).not.toContain("bg-background");
    expect(html).not.toContain("bg-card");
    expect(html).not.toContain("ring-border/70");
    expect(html).toContain("Ready");
    expect(html).toContain("rounded-xl bg-white/5");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders processing and failed status badges", () => {
    const processingHtml = renderDrawer({
      ...readyDocument,
      status: DocumentStatus.processing,
      viewerAvailable: false,
    });
    const failedHtml = renderDrawer({
      ...readyDocument,
      status: DocumentStatus.failed,
      viewerAvailable: false,
    });

    expect(processingHtml).toContain("Processing");
    expect(processingHtml).toContain("This document is still being prepared.");
    expect(failedHtml).toContain("Failed");
    expect(failedHtml).toContain(
      "This document could not be prepared for inline viewing."
    );
  });

  it("renders processing errors as an alert callout", () => {
    const html = renderDrawer({
      ...readyDocument,
      status: DocumentStatus.failed,
      viewerAvailable: false,
      processingError: "LibreOffice conversion failed",
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Processing error");
    expect(html).toContain("LibreOffice conversion failed");
  });
});
