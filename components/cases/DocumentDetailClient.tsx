"use client";

import { HeaderBreadcrumbOverride } from "@/components/AppBreadcrumb";
import { DocumentCopyIconButtons } from "@/components/cases/DocumentCopyIconButtons";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCaseDocumentDetailQuery } from "@/hooks/use-cases";
import type {
  DocumentDetailData,
  DocumentStatusValue,
} from "@/lib/document-detail";
import { Route } from "@/lib/constants";

function formatBytes(bytes: string | null): string {
  if (bytes === null) return "Unknown size";

  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const base = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(base)),
    sizes.length - 1
  );

  return `${parseFloat((value / Math.pow(base, exponent)).toFixed(2))} ${sizes[exponent]}`;
}

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
  const availabilityDescription =
    data.status === "ready" && !data.viewerAvailable
      ? "This document finished processing, but its viewer copy is unavailable right now."
      : status.description;
  const createdAt = new Date(data.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <HeaderBreadcrumbOverride
        segments={[
          { label: "Cases", href: Route.Cases },
          { label: "Documents", href: `/cases/${caseId}` },
          { label: data.originalFilename },
        ]}
      />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Document Viewer</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review the viewer copy for this case document.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}
            >
              {status.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {data.originalFilename}
            </h1>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {data.controlNumber}
            </p>
          </div>

          <Separator />

          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Uploaded
              </dt>
              <dd>{createdAt}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                File Size
              </dt>
              <dd>{formatBytes(data.fileSizeBytes)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                MIME Type
              </dt>
              <dd className="break-all">{data.mimeType ?? "Unknown type"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Copies Downloaded
              </dt>
              <dd>{data.downloadCount}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Availability
              </dt>
              <dd>{availabilityDescription}</dd>
            </div>
          </dl>

          {data.processingError ? (
            <>
              <Separator />
              <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-medium tracking-[0.14em] text-destructive uppercase">
                  Processing Error
                </p>
                <p className="text-sm text-destructive">
                  {data.processingError}
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-h-[28rem]">
        <CardHeader>
          <CardTitle>Viewer</CardTitle>
          <CardDescription>
            Review the read-only viewer copy for this case document.
          </CardDescription>
          {data.downloadAvailable ? (
            <CardAction>
              <DocumentCopyIconButtons
                caseId={caseId}
                documentId={documentId}
                filename={data.originalFilename}
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex min-h-[24rem] flex-1">
          {data.viewerAvailable ? (
            <div className="mx-auto flex w-full overflow-hidden border bg-muted/10">
              <iframe
                title={`Read-only viewer for ${data.originalFilename}`}
                src={`/api/documents/${data.id}/viewer`}
                className="w-full bg-white"
                style={{ aspectRatio: "8.5 / 14" }}
              />
            </div>
          ) : (
            <div className="flex min-h-[24rem] w-full items-center justify-center rounded-lg border border-dashed bg-muted/25 p-6 text-center">
              <div className="max-w-md space-y-2">
                <p className="font-medium">
                  This document is not ready for inline viewing yet.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {availabilityDescription}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
