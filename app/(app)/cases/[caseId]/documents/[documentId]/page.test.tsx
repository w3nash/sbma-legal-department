import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const documentFindUniqueMock = vi.hoisted(() => vi.fn());
const documentDetailClientMock = vi.hoisted(() => vi.fn(() => null));
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

vi.mock("@/components/cases/DocumentDetailClient", () => ({
  DocumentDetailClient: documentDetailClientMock,
}));

describe("document viewer page", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("passes query-backed initial data into the document detail client", async () => {
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
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-1" }),
    });
    renderToStaticMarkup(element);

    expect(documentDetailClientMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-1",
        initialData: {
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
      },
      undefined
    );
  });

  it("passes failed-document state into the document detail client", async () => {
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
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-2" }),
    });
    renderToStaticMarkup(element);

    expect(documentDetailClientMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-2",
        initialData: expect.objectContaining({
          id: "doc-2",
          viewerAvailable: false,
          downloadAvailable: false,
          processingError: "LibreOffice failed",
          status: DocumentStatus.failed,
        }),
      },
      undefined
    );
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

  it("marks unavailable artifacts in the initial query data", async () => {
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
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { default: DocumentViewerPage } = await import("./page");
    const element = await DocumentViewerPage({
      params: Promise.resolve({ caseId: "case-1", documentId: "doc-5" }),
    });
    renderToStaticMarkup(element);

    expect(documentDetailClientMock).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        documentId: "doc-5",
        initialData: expect.objectContaining({
          viewerAvailable: false,
          downloadAvailable: false,
          status: DocumentStatus.ready,
        }),
      },
      undefined
    );
  });
});
