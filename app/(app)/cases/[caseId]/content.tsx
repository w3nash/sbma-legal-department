"use client";

import { useCaseDocumentsQuery } from "@/hooks/use-cases";
import type { CaseDocumentRow } from "@/lib/case-data";
import { DocumentList } from "@/components/cases/DocumentList";
import { Skeleton } from "@/components/ui/skeleton";

function DocumentsSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-md" />
    </div>
  );
}

export function CaseDocumentsContent({
  caseId,
  canUpload,
  initialDocuments,
}: {
  caseId: string;
  canUpload: boolean;
  initialDocuments: CaseDocumentRow[];
}) {
  const {
    data: documents = initialDocuments,
    error,
    isLoading,
  } = useCaseDocumentsQuery(caseId, initialDocuments);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (isLoading && documents.length === 0) {
    return <DocumentsSkeleton />;
  }

  return (
    <DocumentList documents={documents} caseId={caseId} canUpload={canUpload} />
  );
}
