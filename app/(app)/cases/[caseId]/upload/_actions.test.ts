import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const caseFindUniqueMock = vi.hoisted(() => vi.fn());
const caseMemberFindUniqueMock = vi.hoisted(() => vi.fn());
const documentCreateMock = vi.hoisted(() => vi.fn());
const documentDeleteManyMock = vi.hoisted(() => vi.fn());
const generateFileKeyMock = vi.hoisted(() => vi.fn());
const encryptKeyMock = vi.hoisted(() => vi.fn());
const encryptFileMock = vi.hoisted(() => vi.fn());
const ensureStorageBucketMock = vi.hoisted(() => vi.fn());
const enqueueDocumentProcessingJobMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());
const uuidv4Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guards", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: {
      findUnique: caseFindUniqueMock,
    },
    caseMember: {
      findUnique: caseMemberFindUniqueMock,
    },
    document: {
      create: documentCreateMock,
      deleteMany: documentDeleteManyMock,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  generateFileKey: generateFileKeyMock,
  encryptKey: encryptKeyMock,
  encryptFile: encryptFileMock,
}));

vi.mock("@/lib/s3", () => ({
  BUCKET_NAME: "test-bucket",
  s3Client: {
    send: s3SendMock,
  },
}));

vi.mock("@/lib/s3-bucket", () => ({
  ensureStorageBucket: ensureStorageBucketMock,
}));

vi.mock("@/lib/document-processing", () => ({
  enqueueDocumentProcessingJob: enqueueDocumentProcessingJobMock,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("uuid", () => ({
  v4: uuidv4Mock,
}));

describe("uploadDocuments", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uploads encrypted source files, creates processing documents, enqueues jobs, and audits each file", async () => {
    const user = { id: "user-1", role: UserRole.Member };
    const firstFile = new File(["first"], "../unsafe/pleading.pdf", {
      type: "application/pdf",
    });
    const secondFile = new File(["second"], "evidence.docx", {
      type: "application/octet-stream",
    });
    const formData = new FormData();
    formData.append("files", firstFile);
    formData.append("files", secondFile);

    requireAuthMock.mockResolvedValue({ user });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue({
      role: MembershipRole.Uploader,
    });
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "10.0.0.1" })
    );
    uuidv4Mock
      .mockReturnValueOnce("control-1")
      .mockReturnValueOnce("control-2");
    generateFileKeyMock
      .mockReturnValueOnce("file-key-1")
      .mockReturnValueOnce("file-key-2");
    encryptKeyMock
      .mockReturnValueOnce("encrypted-key-1")
      .mockReturnValueOnce("encrypted-key-2");
    encryptFileMock
      .mockReturnValueOnce(Buffer.from("encrypted-source-1"))
      .mockReturnValueOnce(Buffer.from("encrypted-source-2"));
    documentCreateMock
      .mockResolvedValueOnce({ id: "doc-1" })
      .mockResolvedValueOnce({ id: "doc-2" });

    const { uploadDocuments } = await import("./_actions");
    const result = await uploadDocuments("case-1", formData);

    expect(result).toEqual({
      success: true,
      documentIds: ["doc-1", "doc-2"],
      createdCount: 2,
    });
    expect(ensureStorageBucketMock).toHaveBeenCalledOnce();
    expect(s3SendMock).toHaveBeenCalledTimes(2);
    expect(s3SendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-1/source.enc",
          Body: Buffer.from("encrypted-source-1"),
        },
      })
    );
    expect(s3SendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-2/source.enc",
          Body: Buffer.from("encrypted-source-2"),
        },
      })
    );
    expect(s3SendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(documentCreateMock).toHaveBeenNthCalledWith(1, {
      data: {
        caseId: "case-1",
        controlNumber: "control-1",
        status: DocumentStatus.processing,
        originalFilename: "../unsafe/pleading.pdf",
        storedSourceKey: "documents/case-1/control-1/source.enc",
        storedOriginalKey: null,
        storedViewerKey: null,
        fileSizeBytes: BigInt(firstFile.size),
        mimeType: "application/pdf",
        encryptionKey: "encrypted-key-1",
        uploadedById: "user-1",
      },
    });
    expect(documentCreateMock).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        controlNumber: "control-2",
        originalFilename: "evidence.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    });
    expect(enqueueDocumentProcessingJobMock).toHaveBeenNthCalledWith(
      1,
      "doc-1"
    );
    expect(enqueueDocumentProcessingJobMock).toHaveBeenNthCalledWith(
      2,
      "doc-2"
    );
    expect(logAuditMock).toHaveBeenCalledTimes(2);
    expect(logAuditMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "UPLOAD",
        userId: "user-1",
        documentId: "doc-1",
        ipAddress: "10.0.0.1",
        metadata: { phase: "queued" },
      })
    );
  });

  it("throws Unauthorized when the user cannot upload to the case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue({ role: MembershipRole.Viewer });

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("case-1", new FormData())).rejects.toThrow(
      "Unauthorized"
    );
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("throws when no files are provided", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("case-1", new FormData())).rejects.toThrow(
      "No files provided"
    );
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("throws before external writes when the case does not exist", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue(null);
    caseMemberFindUniqueMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.append("files", new File(["pdf"], "pleading.pdf"));

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("missing-case", formData)).rejects.toThrow(
      "Case not found"
    );

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(documentCreateMock).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before reading or external writes", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    const file = new File(["pdf"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
    const arrayBufferSpy = vi.spyOn(file, "arrayBuffer");
    const formData = new FormData();
    formData.append("files", file);

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("case-1", formData)).rejects.toThrow(
      "File exceeds 50MB upload limit"
    );

    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types before external writes", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.append(
      "files",
      new File(["text"], "notes.txt", { type: "text/plain" })
    );

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("case-1", formData)).rejects.toThrow(
      "Unsupported file type"
    );

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(documentCreateMock).not.toHaveBeenCalled();
  });

  it("cleans up uploaded sources and processing rows when queueing fails", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    headersMock.mockResolvedValue(new Headers());
    uuidv4Mock.mockReturnValue("control-1");
    generateFileKeyMock.mockReturnValue("file-key");
    encryptKeyMock.mockReturnValue("encrypted-key");
    encryptFileMock.mockReturnValue(Buffer.from("encrypted-source"));
    documentCreateMock.mockResolvedValue({ id: "doc-1" });
    enqueueDocumentProcessingJobMock.mockRejectedValue(new Error("redis down"));
    const formData = new FormData();
    formData.append(
      "files",
      new File(["pdf"], "pleading.pdf", { type: "application/pdf" })
    );

    const { uploadDocuments } = await import("./_actions");
    await expect(uploadDocuments("case-1", formData)).rejects.toThrow(
      "redis down"
    );

    expect(documentDeleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["doc-1"] } },
    });
    expect(s3SendMock.mock.calls.at(-1)?.[0]).toBeInstanceOf(
      DeleteObjectCommand
    );
    expect(s3SendMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-1/source.enc",
        },
      })
    );
  });
});
