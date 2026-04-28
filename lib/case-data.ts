export type DocumentProcessingStatus = "processing" | "ready" | "failed";

export type CaseDocumentRow = {
  id: string;
  controlNumber: string;
  originalFilename: string;
  createdAt: string;
  fileSizeBytes: number | null;
  status: DocumentProcessingStatus;
  processingError: string | null;
};

export type CaseSummary = {
  documentCount: number;
  memberCount: number;
  processingDocumentCount: number;
};
