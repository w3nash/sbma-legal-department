import { GetObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const documentFindUniqueMock = vi.hoisted(() => vi.fn());
const redisIncrMock = vi.hoisted(() => vi.fn());
const redisExpireMock = vi.hoisted(() => vi.fn());
const redisTtlMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const decryptKeyMock = vi.hoisted(() => vi.fn());
const decryptFileMock = vi.hoisted(() => vi.fn());
const addWatermarkMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/redis", () => ({
  redis: {
    incr: redisIncrMock,
    expire: redisExpireMock,
    ttl: redisTtlMock,
  },
}));

vi.mock("@/lib/s3", () => ({
  BUCKET_NAME: "test-bucket",
  s3Client: {
    send: s3SendMock,
  },
}));

vi.mock("@/lib/crypto", () => ({
  decryptKey: decryptKeyMock,
  decryptFile: decryptFileMock,
}));

vi.mock("@/lib/watermark", () => ({
  addWatermark: addWatermarkMock,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

describe("GET /api/documents/[documentId]/download", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T08:09:10.000Z"));

    requireAuthMock.mockResolvedValue({
      user: {
        id: "user-1",
        role: UserRole.Member,
        name: "Taylor Test",
        email: "taylor@example.com",
      },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-123",
      originalFilename: "Evidence.pdf",
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-1/CTRL-123/original.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });
    redisIncrMock.mockResolvedValue(1);
    redisExpireMock.mockResolvedValue(1);
    redisTtlMock.mockResolvedValue(3599);
    s3SendMock.mockResolvedValue({
      Body: {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(Uint8Array.from([1, 2, 3])),
      },
    });
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock.mockReturnValue(Buffer.from("%PDF-original"));
    addWatermarkMock.mockResolvedValue(Buffer.from("%PDF-download"));
    logAuditMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("streams a watermarked pdf attachment for an authorized user", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/documents/doc-1/download", {
        headers: {
          "user-agent": "Vitest",
          "x-forwarded-for": "203.0.113.1, 198.51.100.2",
        },
      }),
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );

    expect(documentFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
      })
    );
    expect(redisIncrMock).toHaveBeenCalledWith("download:user-1:doc-1");
    expect(redisExpireMock).toHaveBeenCalledWith("download:user-1:doc-1", 3600);
    expect(s3SendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/CTRL-123/original.enc",
        },
      })
    );
    expect(s3SendMock.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(decryptKeyMock).toHaveBeenCalledWith("wrapped-key");
    expect(decryptFileMock).toHaveBeenCalledWith(
      Buffer.from([1, 2, 3]),
      "file-key"
    );
    expect(addWatermarkMock).toHaveBeenCalledWith(
      Buffer.from("%PDF-original"),
      "Control Number: CTRL-123 | User: Taylor Test | Email: taylor@example.com | IP: 203.0.113.1 | Timestamp: 2026-04-28T08:09:10.000Z"
    );
    expect(logAuditMock).toHaveBeenCalledWith({
      action: "DOWNLOAD",
      userId: "user-1",
      documentId: "doc-1",
      caseId: "case-1",
      ipAddress: "203.0.113.1",
      userAgent: "Vitest",
      metadata: {
        controlNumber: "CTRL-123",
        downloadedAt: "2026-04-28T08:09:10.000Z",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Evidence.pdf"'
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("%PDF-download")
    );
  });

  it("returns 403 when the user cannot download the document", async () => {
    documentFindUniqueMock.mockResolvedValueOnce({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-123",
      originalFilename: "Evidence.pdf",
      status: DocumentStatus.ready,
      storedOriginalKey: "documents/case-1/CTRL-123/original.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "someone-else", role: MembershipRole.Viewer }],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Unauthorized" });
    expect(redisIncrMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the document is not ready", async () => {
    documentFindUniqueMock.mockResolvedValueOnce({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-123",
      originalFilename: "Evidence.pdf",
      status: DocumentStatus.processing,
      storedOriginalKey: "documents/case-1/CTRL-123/original.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Document is not ready for download",
    });
    expect(redisIncrMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the original artifact key is missing", async () => {
    documentFindUniqueMock.mockResolvedValueOnce({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "CTRL-123",
      originalFilename: "Evidence.pdf",
      status: DocumentStatus.ready,
      storedOriginalKey: null,
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Original document is unavailable",
    });
    expect(redisIncrMock).not.toHaveBeenCalled();
  });

  it("returns 429 with retry-after when the user exceeds the fixed window limit", async () => {
    redisIncrMock.mockResolvedValueOnce(31);
    redisTtlMock.mockResolvedValueOnce(120);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(await response.json()).toEqual({
      message: "Download limit exceeded",
    });
    expect(redisExpireMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the S3 body cannot be read", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    s3SendMock.mockResolvedValueOnce({ Body: {} });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: "Document storage unavailable",
    });
    expect(addWatermarkMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Document download failed",
      expect.objectContaining({
        documentId: "doc-1",
        error: "S3 object body is not readable",
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it("sanitizes non-ASCII watermark fields before rendering the PDF", async () => {
    requireAuthMock.mockResolvedValue({
      user: {
        id: "user-1",
        role: UserRole.Member,
        name: "山田太郎",
        email: "tést@example.com",
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://example.com/api/documents/doc-1/download", {
        headers: {
          "user-agent": "Vitest",
          "x-forwarded-for": "203.0.113.1",
        },
      }),
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );

    expect(response.status).toBe(200);
    expect(addWatermarkMock).toHaveBeenCalledWith(
      Buffer.from("%PDF-original"),
      "Control Number: CTRL-123 | User: ???? | Email: te?st@example.com | IP: 203.0.113.1 | Timestamp: 2026-04-28T08:09:10.000Z"
    );
  });
});
