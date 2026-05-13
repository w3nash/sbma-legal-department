import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentStatus } from "@/generated/prisma/client";

const useCaseDocumentDetailQueryMock = vi.hoisted(() => vi.fn());
const documentCopyIconButtonsMock = vi.hoisted(() => vi.fn(() => null));
const headerBreadcrumbOverrideMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/hooks/use-cases", () => ({
  useCaseDocumentDetailQuery: useCaseDocumentDetailQueryMock,
}));

vi.mock("@/components/cases/DocumentCopyIconButtons", () => ({
  DocumentCopyIconButtons: documentCopyIconButtonsMock,
}));

vi.mock("@/components/AppBreadcrumb", () => ({
  HeaderBreadcrumbOverride: headerBreadcrumbOverrideMock,
}));

describe("DocumentDetailClient", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("renders legal-size iframe viewer and icon actions from query data", async () => {
    useCaseDocumentDetailQueryMock.mockReturnValue({
      data: {
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
      },
    });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-1"
        initialData={{
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
        }}
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
    expect(documentCopyIconButtonsMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-1",
        filename: "Pleading.pdf",
      },
      undefined
    );
    expect(html).toContain('style="aspect-ratio:8.5 / 14"');
    expect(html).toContain(
      'src="/api/documents/doc-1/viewer#toolbar=0&amp;navpanes=0&amp;scrollbar=1"'
    );
  });

  it("shows the unavailable viewer state from query data", async () => {
    useCaseDocumentDetailQueryMock.mockReturnValue({
      data: {
        id: "doc-2",
        caseId: "case-1",
        controlNumber: "CTRL-002",
        downloadCount: 0,
        originalFilename: "Pending.pdf",
        fileSizeBytes: null,
        mimeType: "application/pdf",
        processingError: null,
        status: DocumentStatus.processing,
        createdAt: "2026-04-28T00:00:00.000Z",
        viewerAvailable: false,
        downloadAvailable: false,
      },
    });

    const { DocumentDetailClient } = await import("./DocumentDetailClient");
    const html = renderToStaticMarkup(
      <DocumentDetailClient
        caseId="case-1"
        documentId="doc-2"
        initialData={{
          id: "doc-2",
          caseId: "case-1",
          controlNumber: "CTRL-002",
          downloadCount: 0,
          originalFilename: "Pending.pdf",
          fileSizeBytes: null,
          mimeType: "application/pdf",
          processingError: null,
          status: DocumentStatus.processing,
          createdAt: "2026-04-28T00:00:00.000Z",
          viewerAvailable: false,
          downloadAvailable: false,
        }}
      />
    );

    expect(documentCopyIconButtonsMock).not.toHaveBeenCalled();
    expect(html).toContain(
      "This document is not ready for inline viewing yet."
    );
  });
});
