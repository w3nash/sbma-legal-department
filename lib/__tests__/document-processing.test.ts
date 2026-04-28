import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@/generated/prisma/client";

const documentFindUniqueMock = vi.hoisted(() => vi.fn());
const documentUpdateMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const setexMock = vi.hoisted(() => vi.fn());
const delMock = vi.hoisted(() => vi.fn());
const decryptKeyMock = vi.hoisted(() => vi.fn());
const decryptFileMock = vi.hoisted(() => vi.fn());
const encryptFileMock = vi.hoisted(() => vi.fn());
const convertToPDFMock = vi.hoisted(() => vi.fn());
const addWatermarkMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const mkdtempMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: documentFindUniqueMock,
      update: documentUpdateMock,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  BUCKET_NAME: "test-bucket",
  s3Client: {
    send: s3SendMock,
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    setex: setexMock,
    del: delMock,
  },
}));

vi.mock("@/lib/crypto", () => ({
  decryptKey: decryptKeyMock,
  decryptFile: decryptFileMock,
  encryptFile: encryptFileMock,
}));

vi.mock("@/lib/convert", () => ({
  convertToPDF: convertToPDFMock,
}));

vi.mock("@/lib/watermark", () => ({
  addWatermark: addWatermarkMock,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdtemp: mkdtempMock,
    writeFile: writeFileMock,
    rm: rmMock,
  },
}));

describe("processDocument", () => {
  beforeEach(() => {
    mkdtempMock.mockResolvedValue("/tmp/sbma-process-123");
    writeFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    decryptKeyMock.mockReturnValue(Buffer.from("file-key"));
    decryptFileMock.mockReturnValue(Buffer.from("source-buffer"));
    convertToPDFMock.mockResolvedValue(Buffer.from("%PDF-original"));
    addWatermarkMock.mockResolvedValue(Buffer.from("%PDF-viewer"));
    encryptFileMock
      .mockReturnValueOnce(Buffer.from("encrypted-original"))
      .mockReturnValueOnce(Buffer.from("encrypted-viewer"));
    setexMock.mockResolvedValue("OK");
    delMock.mockResolvedValue(1);
    s3SendMock
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(
            Uint8Array.from([1, 2, 3])
          ),
        },
      })
      .mockResolvedValue({});
    documentUpdateMock.mockResolvedValue({});
    logAuditMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("marks processed documents ready, normalizes the final filename to pdf, and does not write a second upload audit", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    documentFindUniqueMock.mockResolvedValue({
      id: "doc-1",
      caseId: "case-1",
      controlNumber: "control-1",
      originalFilename: "Jonash.docx",
      storedSourceKey: "documents/case-1/control-1/source.enc",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      encryptionKey: Buffer.from("wrapped-key"),
      status: DocumentStatus.processing,
      uploadedById: "user-1",
    });

    const { processDocument } = await import("@/lib/document-processing");
    await processDocument("doc-1");

    expect(documentUpdateMock).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: expect.objectContaining({
        status: DocumentStatus.ready,
        originalFilename: "Jonash.pdf",
        mimeType: "application/pdf",
      }),
    });
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Starting document processing"),
      expect.objectContaining({ documentId: "doc-1" })
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Document processing completed"),
      expect.objectContaining({
        documentId: "doc-1",
        filename: "Jonash.pdf",
      })
    );
  });

  it("logs processing failures and marks the document failed", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    documentFindUniqueMock.mockResolvedValue({
      id: "doc-2",
      caseId: "case-1",
      controlNumber: "control-2",
      originalFilename: "Broken.docx",
      storedSourceKey: "documents/case-1/control-2/source.enc",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      encryptionKey: Buffer.from("wrapped-key"),
      status: DocumentStatus.processing,
    });
    convertToPDFMock.mockRejectedValueOnce(new Error("LibreOffice failed"));

    const { processDocument } = await import("@/lib/document-processing");
    await processDocument("doc-2");

    expect(documentUpdateMock).toHaveBeenCalledWith({
      where: { id: "doc-2" },
      data: {
        status: DocumentStatus.failed,
        processingError: "LibreOffice failed",
      },
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Document processing failed"),
      expect.objectContaining({
        documentId: "doc-2",
        error: "LibreOffice failed",
      })
    );
  });
});
