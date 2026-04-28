import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const documentFindUniqueMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);
const redirectMock = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  })
);

vi.mock("@/lib/auth-guards", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: documentFindUniqueMock,
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-pdf", () => ({
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: "",
    },
  },
  Document: ({
    file,
    loading,
    children,
  }: {
    file: string;
    loading?: ReactNode;
    children?: ReactNode;
  }) => (
    <div data-testid="react-pdf-document" data-file={file}>
      {children}
      {loading}
    </div>
  ),
  Page: ({
    pageNumber,
    width,
    scale,
    className,
    renderAnnotationLayer,
    renderTextLayer,
  }: {
    pageNumber: number;
    width?: number;
    scale?: number;
    className?: string;
    renderAnnotationLayer?: boolean;
    renderTextLayer?: boolean;
  }) => (
    <div
      data-testid="react-pdf-page"
      data-page-number={pageNumber}
      data-width={width}
      data-scale={scale}
      data-render-annotation-layer={renderAnnotationLayer}
      data-render-text-layer={renderTextLayer}
      className={className}
    >
      Page {pageNumber}
    </div>
  ),
}));

describe("document viewer page", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("renders a ready document with the redesigned shell and pdf viewer", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-001",
      downloadCount: 7,
      originalFilename: "Pleading.pdf",
      fileSizeBytes: BigInt(1024),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-1/CTRL-001/original.enc",
      storedViewerKey: "documents/case-1/CTRL-001/viewer.enc",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Document Viewer");
    expect(html).toContain("Cases");
    expect(html).toContain("Documents");
    expect(html).toContain("Pleading.pdf");
    expect(html).toContain("CTRL-001");
    expect(html).toContain("Copies Downloaded");
    expect(html).toContain(">7<");
    expect(html).toContain("/api/documents/doc-1/download");
    expect(html).toContain('data-testid="react-pdf-document"');
    expect(html).toContain('data-file="/api/documents/doc-1/viewer"');
    expect(html).toContain("Loading viewer copy...");
    expect(html).toContain("Read-only viewer for Pleading.pdf");
    expect(html).not.toContain("Back to case");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("Previous page");
    expect(html).not.toContain("Next page");
  });

  it("renders a failed document without iframe or download action", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-2",
      caseId: "case-1",
      controlNumber: "CTRL-002",
      downloadCount: 0,
      originalFilename: "Evidence.docx",
      fileSizeBytes: null,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      processingError: "LibreOffice failed",
      status: DocumentStatus.failed,
      storedOriginalKey: null,
      storedViewerKey: null,
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-2" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain(
      "This document is not ready for inline viewing yet."
    );
    expect(html).toContain("LibreOffice failed");
    expect(html).toContain("Copies Downloaded");
    expect(html).not.toContain("/api/documents/doc-2/download");
    expect(html).not.toContain("/api/documents/doc-2/viewer");
    expect(html).not.toContain("iframe");
  });

  it("redirects users who cannot view the case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-3",
      caseId: "case-1",
      controlNumber: "CTRL-003",
      downloadCount: 0,
      originalFilename: "Sealed.pdf",
      fileSizeBytes: BigInt(512),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-1/CTRL-003/original.enc",
      storedViewerKey: "documents/case-1/CTRL-003/viewer.enc",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");

    await expect(
      DocumentViewerPage({
        params: Promise.resolve({ caseId: "case-1", documentId: "doc-3" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/cases");
  });

  it("returns not found when the document does not belong to the case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-4",
      caseId: "case-2",
      controlNumber: "CTRL-004",
      downloadCount: 0,
      originalFilename: "Mismatch.pdf",
      fileSizeBytes: BigInt(256),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-2/CTRL-004/original.enc",
      storedViewerKey: "documents/case-2/CTRL-004/viewer.enc",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");

    await expect(
      DocumentViewerPage({
        params: Promise.resolve({ caseId: "case-1", documentId: "doc-4" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("suppresses viewer and download actions when artifacts are missing", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-5",
      caseId: "case-1",
      controlNumber: "CTRL-005",
      downloadCount: 0,
      originalFilename: "ReadyButMissing.pdf",
      fileSizeBytes: BigInt(128),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
      storedOriginalKey: null,
      storedViewerKey: null,
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-5" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain(
      "This document finished processing, but its viewer copy is unavailable right now."
    );
    expect(html).not.toContain("/api/documents/doc-5/download");
    expect(html).not.toContain("/api/documents/doc-5/viewer");
    expect(html).not.toContain("iframe");
  });

  it("renders the viewer as a continuous paper-like stack when the pdf is loaded", async () => {
    vi.resetModules();
    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");
      const queuedStates = [
        [960, vi.fn()],
        [3, vi.fn()],
        [1, vi.fn()],
        [null, vi.fn()],
      ] as const;
      let stateIndex = 0;

      return {
        ...actual,
        useState: ((initialState: unknown) => {
          const nextState = queuedStates[stateIndex];
          if (nextState) {
            stateIndex += 1;
            return nextState;
          }

          return actual.useState(initialState);
        }) as typeof actual.useState,
      };
    });

    const { DocumentPdfViewer } =
      await import("@/components/cases/DocumentPdfViewer");
    const html = renderToStaticMarkup(
      <DocumentPdfViewer
        src="/api/documents/doc-1/viewer"
        title="Pleading.pdf"
      />
    );

    expect(html).toContain("3 pages");
    expect(html).not.toContain("Previous page");
    expect(html).not.toContain("Next page");
    expect(html).toContain('data-page-number="1"');
    expect(html).toContain('data-page-number="2"');
    expect(html).toContain('data-page-number="3"');
    expect(html).toContain('data-width="816"');
    expect(html).toContain("max-w-[8.5in]");
  });
});
