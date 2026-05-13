import { describe, expect, it, vi } from "vitest";
import { performDocumentCopyAction } from "@/lib/document-copy-client";

describe("performDocumentCopyAction", () => {
  it("downloads a counted copy and refreshes afterwards", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["pdf"]), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      })
    );
    const downloadBlobMock = vi.fn();
    const printBlobMock = vi.fn();
    const refreshMock = vi.fn();

    await performDocumentCopyAction({
      intent: "download",
      documentId: "doc-1",
      filename: "Evidence.pdf",
      fetchImpl: fetchMock,
      downloadBlob: downloadBlobMock,
      printBlob: printBlobMock,
      refresh: refreshMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-1/download?intent=download"
    );
    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Blob),
      "Evidence.pdf"
    );
    expect(printBlobMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("prints a counted copy and refreshes afterwards", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["pdf"]), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      })
    );
    const downloadBlobMock = vi.fn();
    const printBlobMock = vi.fn();
    const refreshMock = vi.fn();

    await performDocumentCopyAction({
      intent: "print",
      documentId: "doc-1",
      filename: "Evidence.pdf",
      fetchImpl: fetchMock,
      downloadBlob: downloadBlobMock,
      printBlob: printBlobMock,
      refresh: refreshMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-1/download?intent=print"
    );
    expect(printBlobMock).toHaveBeenCalledWith(
      expect.any(Blob),
      "Evidence.pdf"
    );
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("waits for async print handoff before refreshing query-backed data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["pdf"]), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      })
    );
    const printBlobMock = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 0))
    );
    const refreshMock = vi.fn();

    await performDocumentCopyAction({
      intent: "print",
      documentId: "doc-1",
      filename: "Evidence.pdf",
      fetchImpl: fetchMock,
      downloadBlob: vi.fn(),
      printBlob: printBlobMock,
      refresh: refreshMock,
    });

    expect(printBlobMock.mock.invocationCallOrder[0]).toBeLessThan(
      refreshMock.mock.invocationCallOrder[0]
    );
  });
});
