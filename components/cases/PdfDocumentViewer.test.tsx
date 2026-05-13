import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentStatus } from "@/generated/prisma/client";

const documentCopyIconButtonsMock = vi.hoisted(() =>
  vi.fn(() => (
    <div data-testid="copy-buttons">
      <button type="button" className="size-8" aria-label="Print document">
        Print
      </button>
      <button type="button" className="size-8" aria-label="Download document">
        Download
      </button>
    </div>
  ))
);

vi.mock("@/components/cases/DocumentCopyIconButtons", () => ({
  DocumentCopyIconButtons: documentCopyIconButtonsMock,
}));

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children, file }: { children: ReactNode; file: string }) => (
    <div data-testid="react-pdf-document" data-file={file}>
      {children}
    </div>
  ),
  Page: ({
    pageNumber,
    rotate,
    scale,
    width,
  }: {
    pageNumber: number;
    rotate: number;
    scale: number;
    width?: number;
  }) => (
    <div
      data-testid={`pdf-page-${pageNumber}`}
      data-rotate={rotate}
      data-scale={scale}
      data-width={width}
    >
      Page {pageNumber}
    </div>
  ),
  Thumbnail: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid={`pdf-thumbnail-${pageNumber}`}>Thumbnail {pageNumber}</div>
  ),
}));

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
};

type ViewerProps = {
  caseId?: string;
  documentId?: string;
  data?: typeof readyDocument;
  initialDetailsOpen?: boolean;
  initialNumPages?: number;
  initialSidebarOpen?: boolean;
};

async function renderViewer({
  caseId = "case-1",
  documentId = "doc-1",
  data = readyDocument,
  initialDetailsOpen,
  initialNumPages = 1,
  initialSidebarOpen,
}: ViewerProps = {}): Promise<string> {
  const { PdfDocumentViewer } = await import("./PdfDocumentViewer");

  return renderToStaticMarkup(
    <PdfDocumentViewer
      caseId={caseId}
      documentId={documentId}
      data={data}
      initialDetailsOpen={initialDetailsOpen}
      initialNumPages={initialNumPages}
      initialSidebarOpen={initialSidebarOpen}
    />
  );
}

describe("PdfDocumentViewer", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("renders the approved toolbar, thumbnails, pages, and copy buttons", async () => {
    const html = await renderViewer({ initialNumPages: 3 });

    expect(html).toContain('data-file="/api/documents/doc-1/viewer"');
    expect(html).toContain("Pleading.pdf");
    expect(html).toContain("1 / 3");
    expect(html).toContain('data-testid="pdf-page-scroll"');
    expect(html).toContain('data-testid="pdf-thumbnail-sidebar"');
    expect(html).toContain('data-testid="pdf-page-frame-1"');
    expect(html).toContain("CTRL-001");
    expect(html).toContain("100%");
    expect(html).toContain("Toggle thumbnails");
    expect(html).toContain("Zoom out");
    expect(html).toContain("Zoom in");
    expect(html).toContain("Rotate document");
    expect(html).toContain("Document details");
    expect(html).toContain('data-testid="pdf-thumbnail-1"');
    expect(html).toContain('data-testid="pdf-thumbnail-3"');
    expect(html).toContain('data-testid="pdf-page-1"');
    expect(html).toContain('data-testid="pdf-page-3"');
    expect(html).toContain('data-testid="copy-buttons"');
    expect(documentCopyIconButtonsMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-1",
        filename: "Pleading.pdf",
      },
      undefined
    );
  });

  it("renders the combined page count for screen readers outside the hidden counter", async () => {
    const html = await renderViewer({ initialNumPages: 3 });

    const srOnlyIndex = html.indexOf('<span class="sr-only">1 / 3</span>');
    const visibleCounterIndex = html.indexOf(
      'aria-hidden="true" class="hidden items-center gap-2 font-mono text-base sm:flex'
    );

    expect(srOnlyIndex).toBeGreaterThan(-1);
    expect(visibleCounterIndex).toBeGreaterThan(-1);
    expect(srOnlyIndex).toBeLessThan(visibleCounterIndex);
  });

  it("omits print and download when downloads are unavailable", async () => {
    await renderViewer({
      data: { ...readyDocument, downloadAvailable: false },
    });

    expect(documentCopyIconButtonsMock).not.toHaveBeenCalled();
  });

  it("renders same-size toolbar icon buttons", async () => {
    const html = await renderViewer();

    expect(html).toContain('aria-label="Toggle thumbnails"');
    expect(html).toContain('aria-label="Zoom out"');
    expect(html).toContain('aria-label="Zoom in"');
    expect(html).toContain('aria-label="Rotate document"');
    expect(html).toContain('aria-label="Document details"');
    expect(html).toContain('aria-label="Print document"');
    expect(html).toContain('aria-label="Download document"');
    expect(html).not.toContain("size-9");
  });

  it("keeps the sidebar toggle visible on mobile by hiding the filename", async () => {
    const html = await renderViewer();

    expect(html).toContain('aria-label="Toggle thumbnails"');
    expect(html).not.toContain(
      "hidden text-white hover:bg-white/10 hover:text-white md:inline-flex"
    );
    expect(html).toContain('class="hidden min-w-0 flex-1 font-medium sm:block"');
  });

  it("uses the rendered PDF page dimensions instead of a fixed legal aspect frame", async () => {
    const html = await renderViewer();

    expect(html).toContain('data-testid="pdf-page-frame-1"');
    expect(html).toContain('data-testid="pdf-page-surface-1"');
    expect(html).not.toContain("aspect-[8.5/14]");
    expect(html).not.toContain('data-width="760"');
    expect(html).not.toContain('data-width="320"');
    expect(html).not.toContain("width:760px");
    expect(html).toContain("max-w-full");
    expect(html).toContain("overflow-auto");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("transform:scale(");
    expect(html).not.toContain("transform-origin");
    expect(html).toContain('data-testid="pdf-page-surface-1" class="bg-white shadow-2xl"');
  });

  it("keeps the viewer shell and sidebars inside fixed viewport bounds", async () => {
    const html = await renderViewer();

    expect(html).toContain(
      'class="flex h-[calc(100vh-8rem)] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden'
    );
    expect(html).toContain(
      'class="relative flex h-full min-h-0 flex-1 overflow-hidden'
    );
    expect(html).toContain(
      'class="absolute inset-y-0 right-0 z-20 h-full w-full max-w-sm shrink-0 overflow-y-auto'
    );
    expect(html).toContain("sm:w-80");
    expect(html).toContain("md:static");
    expect(html).toContain("md:z-auto");
    expect(html).toContain("md:w-80");
  });

  it("can render the details drawer with document metadata", async () => {
    const html = await renderViewer();

    expect(html).toContain("Document details");
    expect(html).toContain("CTRL-001");
    expect(html).toContain("April 28, 2026");
    expect(html).toContain("1 KB");
    expect(html).toContain("application/pdf");
    expect(html).toContain("7");
  });

  it("keeps the thumbnail sidebar visible when toggled on mobile", async () => {
    const html = await renderViewer({ initialNumPages: 2 });

    expect(html).toContain('data-testid="pdf-thumbnail-sidebar"');
    expect(html).not.toContain(
      'data-testid="pdf-thumbnail-sidebar" class="hidden h-full w-36'
    );
    expect(html).toContain("md:static");
  });

  it("starts with the details drawer closed on smaller screens", async () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
    });

    const html = await renderViewer({ initialNumPages: 1 });

    expect(html).not.toContain('id="document-details-heading"');
    expect(html).not.toContain("CTRL-001");
  });

  it("can start with the thumbnail sidebar closed", async () => {
    const html = await renderViewer({
      initialSidebarOpen: false,
      initialNumPages: 2,
    });

    expect(html).not.toContain('data-testid="pdf-thumbnail-1"');
    expect(html).toContain('data-testid="pdf-page-1"');
  });
});
