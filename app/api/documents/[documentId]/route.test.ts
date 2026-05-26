import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const documentFindUniqueMock = vi.hoisted(() => vi.fn());

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

describe("GET /api/documents/[documentId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns document detail data for an authorized member", async () => {
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

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
      downloadAvailable: false,
    });
  });

  it("returns 403 for users who cannot view the case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-2",
      caseId: "case-1",
      controlNumber: "CTRL-002",
      downloadCount: 0,
      originalFilename: "Sealed.pdf",
      fileSizeBytes: BigInt(512),
      mimeType: "application/pdf",
      processingError: null,
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-1/CTRL-002/original.enc",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      case: {
        members: [],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-2"),
      {
        params: Promise.resolve({ documentId: "doc-2" }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when the document is missing", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-3"),
      {
        params: Promise.resolve({ documentId: "doc-3" }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: "Document not found",
    });
  });
});
