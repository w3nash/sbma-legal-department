import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const documentFindUniqueMock = vi.hoisted(() => vi.fn());
const redisGetMock = vi.hoisted(() => vi.fn());
const redisSetexMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const decryptKeyMock = vi.hoisted(() => vi.fn());
const decryptFileMock = vi.hoisted(() => vi.fn());
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
    get: redisGetMock,
    setex: redisSetexMock,
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

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

describe("document viewer route", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the decrypted viewer pdf from Redis inline and audits the view", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "user-1", role: MembershipRole.Viewer }],
      },
    });
    redisGetMock.mockResolvedValue(
      Buffer.from("encrypted-viewer").toString("base64")
    );
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock.mockReturnValue(Buffer.from("%PDF-viewer"));
    logAuditMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "10.0.0.1",
        },
      }),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="Pleading.pdf"'
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("%PDF-viewer")
    );
    expect(redisGetMock).toHaveBeenCalledWith("viewer:control-1");
    expect(redisSetexMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith({
      action: "VIEW",
      userId: "user-1",
      documentId: "doc-1",
      caseId: "case-1",
      ipAddress: "10.0.0.1",
      userAgent: "vitest",
      metadata: { source: "redis" },
    });
  });

  it("falls back to S3 on cache miss, rewrites the cache, and audits the S3 source", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });
    redisGetMock.mockResolvedValue(null);
    s3SendMock.mockResolvedValue({
      Body: {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(Uint8Array.from(Buffer.from("encrypted-viewer"))),
      },
    });
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock.mockReturnValue(Buffer.from("%PDF-viewer"));
    logAuditMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "10.0.0.2",
        },
      }),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(200);
    expect(s3SendMock).toHaveBeenCalledOnce();
    expect(redisSetexMock).toHaveBeenCalledWith(
      "viewer:control-1",
      3600,
      Buffer.from("encrypted-viewer").toString("base64")
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VIEW",
        metadata: { source: "s3" },
      })
    );
  });

  it("returns 403 when the user cannot view the document case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [{ userId: "other-user", role: MembershipRole.Viewer }],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
    expect(redisGetMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("refreshes from S3 when the cached viewer payload cannot be decrypted", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });
    redisGetMock.mockResolvedValue(
      Buffer.from("stale-cache").toString("base64")
    );
    s3SendMock.mockResolvedValue({
      Body: {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(Uint8Array.from(Buffer.from("fresh-encrypted"))),
      },
    });
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock
      .mockImplementationOnce(() => {
        throw new Error("bad ciphertext");
      })
      .mockReturnValueOnce(Buffer.from("%PDF-viewer"));
    logAuditMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "10.0.0.2, 10.0.0.3",
        },
      }),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(200);
    expect(s3SendMock).toHaveBeenCalledOnce();
    expect(redisSetexMock).toHaveBeenCalledWith(
      "viewer:control-1",
      3600,
      Buffer.from("fresh-encrypted").toString("base64")
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: "10.0.0.2",
        metadata: { source: "s3" },
      })
    );
  });

  it("returns 409 when the document is not ready", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.processing,
      originalFilename: "Pleading.pdf",
      storedViewerKey: null,
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "Document viewer is not ready",
    });
    expect(redisGetMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the document is ready but has no stored viewer key", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: null,
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "Document viewer is not ready",
    });
    expect(redisGetMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the S3 viewer object body is unreadable", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });
    redisGetMock.mockResolvedValue(null);
    s3SendMock.mockResolvedValue({ Body: {} });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "Viewer file is unavailable",
    });
    expect(decryptKeyMock).not.toHaveBeenCalled();
    expect(decryptFileMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("serves the viewer when Redis is unavailable but S3 is healthy", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: "Pleading.pdf",
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });
    redisGetMock.mockRejectedValue(new Error("redis down"));
    s3SendMock.mockResolvedValue({
      Body: {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(Uint8Array.from(Buffer.from("encrypted-viewer"))),
      },
    });
    redisSetexMock.mockRejectedValue(new Error("redis write failed"));
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock.mockReturnValue(Buffer.from("%PDF-viewer"));
    logAuditMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.status).toBe(200);
    expect(s3SendMock).toHaveBeenCalledOnce();
    expect(redisSetexMock).toHaveBeenCalledOnce();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: "s3" },
      })
    );
  });

  it("sanitizes the inline filename in the response header", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      status: DocumentStatus.ready,
      originalFilename: 'unsafe"file\r\n.pdf',
      storedViewerKey: "documents/case-1/control-1/viewer.enc",
      encryptionKey: "wrapped-key",
      case: {
        members: [],
      },
    });
    redisGetMock.mockResolvedValue(
      Buffer.from("encrypted-viewer").toString("base64")
    );
    decryptKeyMock.mockReturnValue("file-key");
    decryptFileMock.mockReturnValue(Buffer.from("%PDF-viewer"));
    logAuditMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/documents/doc-1/viewer"),
      {
        params: Promise.resolve({ documentId: "doc-1" }),
      }
    );

    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="unsafe_file__.pdf"'
    );
  });
});
