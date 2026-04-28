"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RiUploadLine, RiArticleFill } from "@remixicon/react";

export function DocumentEmptyState({
  canUpload,
  caseId,
}: {
  canUpload: boolean;
  caseId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-7 flex h-[78px] w-[78px] animate-in items-center justify-center rounded-2xl border border-chart-2/15 text-chart-2 duration-700 fill-mode-both zoom-in-95 fade-in"
        style={{
          background: "color-mix(in oklch, var(--chart-2) 7%, transparent)",
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklch, var(--chart-2) 20%, transparent) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
          backgroundPosition: "3px 3px",
        }}
      >
        <RiArticleFill className="size-10" />
      </div>

      <div className="mb-5 flex animate-in items-center gap-3 delay-150 duration-500 fill-mode-both fade-in">
        <div className="h-px w-10 bg-border" />
        <div className="h-[5px] w-[5px] rotate-45 bg-chart-2/35" />
        <div className="h-px w-10 bg-border" />
      </div>

      <div className="animate-in space-y-2 delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        <p className="text-[10.5px] font-semibold tracking-[0.18em] text-muted-foreground/55 uppercase">
          Case Documents
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          No documents filed
        </h2>
      </div>

      <div className="mt-3 flex animate-in flex-col items-center gap-6 delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        <p className="max-w-[260px] text-sm leading-relaxed text-muted-foreground">
          {canUpload
            ? "Upload the first document to begin building this case's file."
            : "No documents have been uploaded to this case yet."}
        </p>
        {canUpload && (
          <Button onClick={() => router.push(`/cases/${caseId}/upload`)}>
            <RiUploadLine className="mr-1 size-4" />
            Upload Documents
          </Button>
        )}
      </div>
    </div>
  );
}
