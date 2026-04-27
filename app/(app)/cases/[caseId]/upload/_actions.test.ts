import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MembershipRole, UserRole } from "@/lib/constants";

const requireAuthMock = vi.hoisted(() => vi.fn());
const caseFindUniqueMock = vi.hoisted(() => vi.fn());
const caseMemberFindUniqueMock = vi.hoisted(() => vi.fn());
const documentCreateMock = vi.hoisted(() => vi.fn());
const convertToPDFMock = vi.hoisted(() => vi.fn());
const generateFileKeyMock = vi.hoisted(() => vi.fn());
const encryptKeyMock = vi.hoisted(() => vi.fn());
const encryptFileMock = vi.hoisted(() => vi.fn());
const addWatermarkMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const redisSetexMock = vi.hoisted(() => vi.fn());
const redisDelMock = vi.hoisted(() => vi.fn());
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
    },
  },
}));

vi.mock("@/lib/convert", () => ({
  convertToPDF: convertToPDFMock,
}));

vi.mock("@/lib/crypto", () => ({
  generateFileKey: generateFileKeyMock,
  encryptKey: encryptKeyMock,
  encryptFile: encryptFileMock,
}));

vi.mock("@/lib/watermark", () => ({
  addWatermark: addWatermarkMock,
}));

vi.mock("@/lib/s3", () => ({
  BUCKET_NAME: "test-bucket",
  s3Client: {
    send: s3SendMock,
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    setex: redisSetexMock,
    del: redisDelMock,
  },
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

describe("uploadDocument", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("converts, encrypts, uploads, caches, records, audits, and returns the document ID", async () => {
    const user = { id: "user-1", role: UserRole.Member };
    const file = new File(["uploaded pdf"], "../unsafe/pleading.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.set("file", file);
    const pdfBuffer = Buffer.from("pdf");
    const encryptedOriginal = Buffer.from("encrypted-original");
    const watermarkedPdf = Buffer.from("watermarked-pdf");
    const encryptedViewer = Buffer.from("encrypted-viewer");

    requireAuthMock.mockResolvedValue({ user });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue({
      role: MembershipRole.Uploader,
    });
    convertToPDFMock.mockResolvedValue(pdfBuffer);
    uuidv4Mock.mockReturnValue("control-123");
    generateFileKeyMock.mockReturnValue("file-key");
    encryptKeyMock.mockReturnValue("encrypted-key");
    encryptFileMock
      .mockReturnValueOnce(encryptedOriginal)
      .mockReturnValueOnce(encryptedViewer);
    addWatermarkMock.mockResolvedValue(watermarkedPdf);
    documentCreateMock.mockResolvedValue({ id: "doc-1" });
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "10.0.0.1" })
    );

    const { uploadDocument } = await import("./_actions");
    const result = await uploadDocument("case-1", formData);

    expect(result).toEqual({ success: true, documentId: "doc-1" });
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(caseMemberFindUniqueMock).toHaveBeenCalledWith({
      where: { caseId_userId: { caseId: "case-1", userId: "user-1" } },
    });
    expect(convertToPDFMock).toHaveBeenCalledWith(
      expect.stringMatching(/sbma-upload-.*pleading\.pdf$/),
      "application/pdf"
    );
    expect(generateFileKeyMock).toHaveBeenCalledOnce();
    expect(encryptKeyMock).toHaveBeenCalledWith("file-key");
    expect(encryptFileMock).toHaveBeenNthCalledWith(1, pdfBuffer, "file-key");
    expect(addWatermarkMock).toHaveBeenCalledWith(
      pdfBuffer,
      "Control Number: control-123"
    );
    expect(encryptFileMock).toHaveBeenNthCalledWith(
      2,
      watermarkedPdf,
      "file-key"
    );
    expect(s3SendMock).toHaveBeenCalledTimes(2);
    expect(s3SendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-123/original.enc",
          Body: encryptedOriginal,
        },
      })
    );
    expect(s3SendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-123/viewer.enc",
          Body: encryptedViewer,
        },
      })
    );
    expect(s3SendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(redisSetexMock).toHaveBeenCalledWith(
      "viewer:control-123",
      3600,
      encryptedViewer.toString("base64")
    );
    expect(documentCreateMock).toHaveBeenCalledWith({
      data: {
        caseId: "case-1",
        controlNumber: "control-123",
        originalFilename: "../unsafe/pleading.pdf",
        storedOriginalKey: "documents/case-1/control-123/original.enc",
        storedViewerKey: "documents/case-1/control-123/viewer.enc",
        fileSizeBytes: BigInt(file.size),
        mimeType: "application/pdf",
        encryptionKey: "encrypted-key",
        uploadedById: "user-1",
      },
    });
    expect(logAuditMock).toHaveBeenCalledWith({
      action: "UPLOAD",
      userId: "user-1",
      documentId: "doc-1",
      caseId: "case-1",
      ipAddress: "10.0.0.1",
    });
  });

  it("throws Unauthorized when the user cannot upload to the case", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue({ role: MembershipRole.Viewer });

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", new FormData())).rejects.toThrow(
      "Unauthorized"
    );
    expect(convertToPDFMock).not.toHaveBeenCalled();
  });

  it("throws when no file is provided", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", new FormData())).rejects.toThrow(
      "No file provided"
    );
  });

  it("throws before external writes when the case does not exist", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("file", new File(["pdf"], "pleading.pdf"));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("missing-case", formData)).rejects.toThrow(
      "Case not found"
    );

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(redisSetexMock).not.toHaveBeenCalled();
    expect(documentCreateMock).not.toHaveBeenCalled();
  });

  it("returns Unauthorized for non-members when the case does not exist", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: UserRole.Member },
    });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    caseFindUniqueMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("file", new File(["pdf"], "pleading.pdf"));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("missing-case", formData)).rejects.toThrow(
      "Unauthorized"
    );

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(redisSetexMock).not.toHaveBeenCalled();
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
    formData.set("file", file);

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", formData)).rejects.toThrow(
      "File exceeds 50MB upload limit"
    );

    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(redisSetexMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types before conversion or external writes", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("file", new File(["text"], "notes.txt", { type: "text/plain" }));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", formData)).rejects.toThrow(
      "Unsupported file type"
    );

    expect(convertToPDFMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(redisSetexMock).not.toHaveBeenCalled();
  });

  it("infers convertible office MIME types from file extension when the browser sends octet-stream", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    convertToPDFMock.mockResolvedValue(Buffer.from("pdf"));
    uuidv4Mock.mockReturnValue("control-123");
    generateFileKeyMock.mockReturnValue("file-key");
    encryptKeyMock.mockReturnValue("encrypted-key");
    encryptFileMock
      .mockReturnValueOnce(Buffer.from("encrypted-original"))
      .mockReturnValueOnce(Buffer.from("encrypted-viewer"));
    addWatermarkMock.mockResolvedValue(Buffer.from("watermarked-pdf"));
    documentCreateMock.mockResolvedValue({ id: "doc-1" });
    headersMock.mockResolvedValue(new Headers());
    const formData = new FormData();
    formData.set(
      "file",
      new File(["docx"], "pleading.docx", {
        type: "application/octet-stream",
      })
    );

    const { uploadDocument } = await import("./_actions");
    await uploadDocument("case-1", formData);

    expect(convertToPDFMock).toHaveBeenCalledWith(
      expect.stringMatching(/pleading\.docx$/),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("cleans up uploaded objects and viewer cache when document persistence fails", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    convertToPDFMock.mockResolvedValue(Buffer.from("pdf"));
    uuidv4Mock.mockReturnValue("control-123");
    generateFileKeyMock.mockReturnValue("file-key");
    encryptKeyMock.mockReturnValue("encrypted-key");
    encryptFileMock
      .mockReturnValueOnce(Buffer.from("encrypted-original"))
      .mockReturnValueOnce(Buffer.from("encrypted-viewer"));
    addWatermarkMock.mockResolvedValue(Buffer.from("watermarked-pdf"));
    redisSetexMock.mockResolvedValue("OK");
    documentCreateMock.mockRejectedValue(new Error("db down"));
    headersMock.mockResolvedValue(new Headers());
    const formData = new FormData();
    formData.set("file", new File(["pdf"], "pleading.pdf"));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", formData)).rejects.toThrow(
      "db down"
    );

    expect(redisDelMock).toHaveBeenCalledWith("viewer:control-123");
    const deleteCommands = s3SendMock.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof DeleteObjectCommand);
    expect(deleteCommands).toHaveLength(2);
    expect(deleteCommands).toEqual([
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-123/original.enc",
        },
      }),
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-123/viewer.enc",
        },
      }),
    ]);
  });

  it("rejects converted PDFs that exceed the upload size limit before external writes", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    convertToPDFMock.mockResolvedValue(Buffer.alloc(50 * 1024 * 1024 + 1));
    const formData = new FormData();
    formData.set("file", new File(["small"], "pleading.docx"));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", formData)).rejects.toThrow(
      "Converted PDF exceeds 50MB upload limit"
    );

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(redisSetexMock).not.toHaveBeenCalled();
    expect(documentCreateMock).not.toHaveBeenCalled();
  });

  it("cleans up uploaded original when the viewer PDF exceeds the upload size limit", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.Admin },
    });
    caseFindUniqueMock.mockResolvedValue({ id: "case-1" });
    caseMemberFindUniqueMock.mockResolvedValue(null);
    convertToPDFMock.mockResolvedValue(Buffer.from("pdf"));
    uuidv4Mock.mockReturnValue("control-123");
    generateFileKeyMock.mockReturnValue("file-key");
    encryptKeyMock.mockReturnValue("encrypted-key");
    encryptFileMock.mockReturnValueOnce(Buffer.from("encrypted-original"));
    addWatermarkMock.mockResolvedValue(Buffer.alloc(50 * 1024 * 1024 + 1));
    const formData = new FormData();
    formData.set("file", new File(["small"], "pleading.pdf"));

    const { uploadDocument } = await import("./_actions");
    await expect(uploadDocument("case-1", formData)).rejects.toThrow(
      "Viewer PDF exceeds 50MB upload limit"
    );

    const deleteCommands = s3SendMock.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof DeleteObjectCommand);
    expect(deleteCommands).toEqual([
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "documents/case-1/control-123/original.enc",
        },
      }),
    ]);
    expect(redisSetexMock).not.toHaveBeenCalled();
    expect(documentCreateMock).not.toHaveBeenCalled();
  });
});
