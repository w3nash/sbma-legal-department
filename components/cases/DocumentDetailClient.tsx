"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { HeaderBreadcrumbOverride } from "@/components/AppBreadcrumb";
import { useCaseDocumentDetailQuery } from "@/hooks/use-cases";
import type {
  DocumentDetailData,
  DocumentStatusValue,
} from "@/lib/document-detail";
import { Route } from "@/lib/constants";

const PdfDocumentViewer = dynamic(
  () =>
    import("@/components/cases/PdfDocumentViewer").then(
      (module) => module.PdfDocumentViewer
    ),
  { ssr: false }
);

const statusCopy: Record<
  DocumentStatusValue,
  { label: string; description: string; tone: string }
> = {
  ready: {
    label: "Ready",
    description: "This viewer copy is ready for inline viewing.",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  processing: {
    label: "Processing",
    description:
      "This document is still being prepared. Refresh later to check whether the viewer copy is available.",
    tone: "bg-amber-500/10 text-amber-700",
  },
  failed: {
    label: "Failed",
    description: "This document could not be prepared for inline viewing.",
    tone: "bg-destructive/10 text-destructive",
  },
};

function getAvailabilityDescription(data: DocumentDetailData): string {
  if (data.status === "ready" && !data.viewerAvailable) {
    return "This document finished processing, but its viewer copy is unavailable right now.";
  }

  return statusCopy[data.status].description;
}

export function DocumentDetailClient({
  caseId,
  documentId,
  initialData,
}: {
  caseId: string;
  documentId: string;
  initialData: DocumentDetailData;
}) {
  const query = useCaseDocumentDetailQuery(caseId, documentId, initialData);
  const data = query.data ?? initialData;
  const status = statusCopy[data.status];
  const availabilityDescription = getAvailabilityDescription(data);
  const breadcrumbSegments = useMemo(
    () => [
      { label: "Cases", href: Route.Cases },
      { label: "Documents", href: `/cases/${caseId}` },
      { label: data.originalFilename },
    ],
    [caseId, data.originalFilename]
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden">
      <HeaderBreadcrumbOverride segments={breadcrumbSegments} />

      {data.viewerAvailable ? (
        <PdfDocumentViewer caseId={caseId} documentId={documentId} data={data} />
      ) : (
        <div className="flex min-h-[calc(100vh-12rem)] w-full items-center justify-center rounded-xl border border-dashed bg-muted/25 p-6 text-center">
          <div className="max-w-md space-y-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}
            >
              {status.label}
            </span>
            <p className="font-medium">
              This document is not ready for inline viewing yet.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {availabilityDescription}
            </p>
            {data.processingError ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {data.processingError}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
