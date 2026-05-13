export type DocumentStatusValue = "ready" | "processing" | "failed";

export type DocumentDetailData = {
  id: string;
  caseId: string;
  controlNumber: string;
  downloadCount: number;
  originalFilename: string;
  fileSizeBytes: string | null;
  mimeType: string | null;
  processingError: string | null;
  status: DocumentStatusValue;
  createdAt: string;
  viewerAvailable: boolean;
  downloadAvailable: boolean;
};

export function serializeDocumentDetail(
  document: {
    id: string;
    caseId: string;
    controlNumber: string;
    downloadCount: number;
    originalFilename: string;
    fileSizeBytes: bigint | null;
    mimeType: string | null;
    processingError: string | null;
    status: DocumentStatusValue;
    storedOriginalKey: string | null;
    createdAt: Date;
  },
  canDownload: boolean
): DocumentDetailData {
  const viewerAvailable =
    document.status === "ready" && document.storedOriginalKey !== null;
  const downloadAvailable = canDownload && viewerAvailable;

  return {
    id: document.id,
    caseId: document.caseId,
    controlNumber: document.controlNumber,
    downloadCount: document.downloadCount,
    originalFilename: document.originalFilename,
    fileSizeBytes:
      document.fileSizeBytes === null
        ? null
        : document.fileSizeBytes.toString(),
    mimeType: document.mimeType,
    processingError: document.processingError,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    viewerAvailable,
    downloadAvailable,
  };
}
