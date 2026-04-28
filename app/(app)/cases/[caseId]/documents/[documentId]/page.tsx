import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentPdfViewer } from "@/components/cases/DocumentPdfViewer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DocumentStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth-guards";
import { MembershipRole, Route, UserRole } from "@/lib/constants";
import { canDownloadDocument, canViewCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RiDownloadLine } from "@remixicon/react";

function formatBytes(bytes: bigint | null): string {
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
  DocumentStatus,
  { label: string; description: string; tone: string }
> = {
  [DocumentStatus.ready]: {
    label: "Ready",
    description: "This viewer copy is ready for inline viewing.",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  [DocumentStatus.processing]: {
    label: "Processing",
    description:
      "This document is still being prepared. Refresh later to check whether the viewer copy is available.",
    tone: "bg-amber-500/10 text-amber-700",
  },
  [DocumentStatus.failed]: {
    label: "Failed",
    description: "This document could not be prepared for inline viewing.",
    tone: "bg-destructive/10 text-destructive",
  },
};

export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ caseId: string; documentId: string }>;
}) {
  const { caseId, documentId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      caseId: true,
      controlNumber: true,
      downloadCount: true,
      originalFilename: true,
      fileSizeBytes: true,
      mimeType: true,
      processingError: true,
      status: true,
      storedOriginalKey: true,
      storedViewerKey: true,
      createdAt: true,
      case: {
        select: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!document || document.caseId !== caseId) {
    notFound();
  }

  const membership =
    document.case.members.find((member) => member.userId === user.id) ?? null;
  const userRole = user.role as UserRole;
  const memberRole = membership
    ? { role: membership.role as MembershipRole }
    : null;

  if (!canViewCase({ role: userRole }, memberRole)) {
    redirect("/cases");
  }

  const canDownload = canDownloadDocument({ role: userRole }, memberRole);
  const status = statusCopy[document.status];
  const viewerAvailable =
    document.status === DocumentStatus.ready &&
    document.storedViewerKey !== null;
  const downloadAvailable =
    canDownload &&
    document.status === DocumentStatus.ready &&
    document.storedOriginalKey !== null;
  const availabilityDescription =
    document.status === DocumentStatus.ready && !viewerAvailable
      ? "This document finished processing, but its viewer copy is unavailable right now."
      : status.description;
  const createdAt = document.createdAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 py-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={Route.Cases} />}>
              Cases
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/cases/${caseId}`} />}>
              Documents
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{document.originalFilename}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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
              {document.originalFilename}
            </h1>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {document.controlNumber}
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
              <dd>{formatBytes(document.fileSizeBytes)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                MIME Type
              </dt>
              <dd className="break-all">
                {document.mimeType ?? "Unknown type"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Copies Downloaded
              </dt>
              <dd>{document.downloadCount}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Availability
              </dt>
              <dd>{availabilityDescription}</dd>
            </div>
          </dl>

          {document.processingError ? (
            <>
              <Separator />
              <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-medium tracking-[0.14em] text-destructive uppercase">
                  Processing Error
                </p>
                <p className="text-sm text-destructive">
                  {document.processingError}
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
          {downloadAvailable ? (
            <CardAction>
              <Button
                nativeButton={false}
                render={<a href={`/api/documents/${document.id}/download`} />}
              >
                <RiDownloadLine className="size-4" />
                Download
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex min-h-[24rem] flex-1">
          {viewerAvailable ? (
            <DocumentPdfViewer
              src={`/api/documents/${document.id}/viewer`}
              title={document.originalFilename}
            />
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
