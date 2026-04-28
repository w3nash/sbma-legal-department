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

describe("document viewer page", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("renders a ready document with iframe and download action", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-001",
      originalFilename: "Pleading.pdf",
      fileSizeBytes: BigInt(1024),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
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
    expect(html).toContain("Pleading.pdf");
    expect(html).toContain("CTRL-001");
    expect(html).toContain("/api/documents/doc-1/download");
    expect(html).toContain("/api/documents/doc-1/viewer");
    expect(html).toContain("iframe");
  });

  it("renders a failed document without iframe or download action", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-2",
      caseId: "case-1",
      controlNumber: "CTRL-002",
      originalFilename: "Evidence.docx",
      fileSizeBytes: null,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      processingError: "LibreOffice failed",
      status: DocumentStatus.failed,
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
      originalFilename: "Sealed.pdf",
      fileSizeBytes: BigInt(512),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
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
      originalFilename: "Mismatch.pdf",
      fileSizeBytes: BigInt(256),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
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
});
