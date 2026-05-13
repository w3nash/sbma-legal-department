import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentStatus } from "@/generated/prisma/client";

const useCaseDocumentDetailQueryMock = vi.hoisted(() => vi.fn());
const pdfDocumentViewerMock = vi.hoisted(() =>
  vi.fn(() => <section data-testid="pdf-document-viewer">PDF viewer</section>)
);
const dynamicMock = vi.hoisted(() => vi.fn(() => pdfDocumentViewerMock));
const headerBreadcrumbOverrideMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("next/dynamic", () => ({
  default: dynamicMock,
}));

vi.mock("@/hooks/use-cases", () => ({
  useCaseDocumentDetailQuery: useCaseDocumentDetailQueryMock,
}));

vi.mock("@/components/cases/PdfDocumentViewer", () => ({
  PdfDocumentViewer: pdfDocumentViewerMock,
}));

vi.mock("@/components/AppBreadcrumb", () => ({
  HeaderBreadcrumbOverride: headerBreadcrumbOverrideMock,
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

describe("DocumentDetailClient", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("renders the focused PDF viewer from query data", async () => {
    useCaseDocumentDetailQueryMock.mockReturnValue({ data: readyDocument });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-1"
        initialData={readyDocument}
      />
    );

    expect(headerBreadcrumbOverrideMock).toHaveBeenCalledWith(
      {
        segments: [
          { label: "Cases", href: "/cases" },
          { label: "Documents", href: "/cases/case-1" },
          { label: "Pleading.pdf" },
        ],
      },
      undefined
    );
    expect(dynamicMock).toHaveBeenCalledWith(expect.any(Function), {
      ssr: false,
    });
    expect(pdfDocumentViewerMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-1",
        data: readyDocument,
      },
      undefined
    );
    expect(html).toContain('data-testid="pdf-document-viewer"');
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("Document Viewer");
  });

  it("wraps the PDF viewer in a width-constrained detail page", async () => {
    useCaseDocumentDetailQueryMock.mockReturnValue({ data: readyDocument });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-1"
        initialData={readyDocument}
      />
    );

    expect(html).toContain(
      'class="flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden"'
    );
  });

  it("shows the unavailable viewer state from query data", async () => {
    const pendingDocument = {
      ...readyDocument,
      id: "doc-2",
      controlNumber: "CTRL-002",
      downloadCount: 0,
      originalFilename: "Pending.pdf",
      fileSizeBytes: null,
      status: DocumentStatus.processing,
      viewerAvailable: false,
      downloadAvailable: false,
    };
    useCaseDocumentDetailQueryMock.mockReturnValue({ data: pendingDocument });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-2"
        initialData={pendingDocument}
      />
    );

    expect(pdfDocumentViewerMock).not.toHaveBeenCalled();
    expect(html).toContain(
      "This document is not ready for inline viewing yet."
    );
  });

  it("shows processing errors without mounting the PDF viewer", async () => {
    const failedDocument = {
      ...readyDocument,
      id: "doc-3",
      originalFilename: "Broken.pdf",
      status: DocumentStatus.failed,
      viewerAvailable: false,
      downloadAvailable: false,
      processingError: "LibreOffice conversion failed",
    };
    useCaseDocumentDetailQueryMock.mockReturnValue({ data: failedDocument });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-3"
        initialData={failedDocument}
      />
    );

    expect(pdfDocumentViewerMock).not.toHaveBeenCalled();
    expect(html).toContain("LibreOffice conversion failed");
    expect(html).toContain("This document is not ready for inline viewing yet.");
  });
});
