"use client";

import type { ReactElement } from "react";
import {
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDownloadCloud2Line,
  RiErrorWarningLine,
  RiFileInfoLine,
  RiFileTextLine,
  RiFingerprintLine,
  RiHardDrive2Line,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocumentDetailData } from "@/lib/document-detail";

type DocumentViewerDetailsDrawerProps = {
  data: DocumentDetailData;
  onClose: () => void;
};

type AvailabilityDetails = {
  description: string;
  label: string;
  variant: "secondary" | "outline" | "destructive";
};

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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getAvailabilityDetails(data: DocumentDetailData): AvailabilityDetails {
  if (data.status === "ready" && data.viewerAvailable) {
    return {
      description: "This viewer copy is ready for inline viewing.",
      label: "Ready",
      variant: "secondary",
    };
  }

  if (data.status === "ready") {
    return {
      description:
        "This document finished processing, but its viewer copy is unavailable right now.",
      label: "Unavailable",
      variant: "outline",
    };
  }

  if (data.status === "processing") {
    return {
      description: "This document is still being prepared.",
      label: "Processing",
      variant: "outline",
    };
  }

  return {
    description: "This document could not be prepared for inline viewing.",
    label: "Failed",
    variant: "destructive",
  };
}

export function DocumentViewerDetailsDrawer({
  data,
  onClose,
}: DocumentViewerDetailsDrawerProps): ReactElement {
  const availability = getAvailabilityDetails(data);
  const fields = [
    {
      label: "Control Number",
      value: data.controlNumber,
      icon: RiFingerprintLine,
    },
    {
      label: "Uploaded",
      value: formatDate(data.createdAt),
      icon: RiCalendarLine,
    },
    {
      label: "File Size",
      value: formatBytes(data.fileSizeBytes),
      icon: RiHardDrive2Line,
    },
    {
      label: "MIME Type",
      value: data.mimeType ?? "Unknown type",
      icon: RiFileInfoLine,
    },
    {
      label: "Copies Downloaded",
      value: String(data.downloadCount),
      icon: RiDownloadCloud2Line,
    },
    {
      label: "Availability",
      value: availability.description,
      icon: RiCheckboxCircleLine,
    },
  ];

  return (
    <aside
      aria-labelledby="document-details-heading"
      className="absolute inset-y-0 right-0 z-20 h-full w-full max-w-sm shrink-0 overflow-y-auto border-l border-white/10 bg-[#181b20] text-white shadow-2xl animate-in fade-in slide-in-from-right-3 duration-200 fill-mode-both sm:w-80 md:static md:z-auto md:w-80"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
            <RiFileTextLine aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="document-details-heading"
                className="font-heading text-base font-medium"
              >
                Document details
              </h2>
              <Badge
                variant={availability.variant}
                className="h-5 border-white/10 bg-white/10 text-[10px] text-white"
              >
                {availability.label}
              </Badge>
            </div>
            <p className="truncate text-sm text-white/60">
              {data.originalFilename}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close document details"
          title="Close document details"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <RiCloseLine aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <dl className="space-y-2.5 p-4 text-sm">
        {fields.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
                <Icon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <dt className="text-xs font-medium tracking-[0.14em] text-white/50 uppercase">
                  {label}
                </dt>
                <dd className="wrap-break-word leading-relaxed text-white/90">{value}</dd>
              </div>
            </div>
          </div>
        ))}
      </dl>

      {data.processingError ? (
        <div
          role="alert"
          className="mx-4 mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-red-100"
        >
          <RiErrorWarningLine
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <div className="space-y-1">
            <p className="font-medium">Processing error</p>
            <p className="leading-relaxed">{data.processingError}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
