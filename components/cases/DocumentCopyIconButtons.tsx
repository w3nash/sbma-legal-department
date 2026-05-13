"use client";

import { startTransition, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RiDownload2Line,
  RiLoader4Line,
  RiPrinterLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type DocumentCopyIntent,
  performDocumentCopyAction,
} from "@/lib/document-copy-client";
import { casesQueryKeys } from "@/lib/query-keys";

export function DocumentCopyIconButtons({
  caseId,
  documentId,
  filename,
}: {
  caseId: string;
  documentId: string;
  filename: string;
}) {
  const queryClient = useQueryClient();
  const [pendingIntent, setPendingIntent] = useState<DocumentCopyIntent | null>(
    null
  );

  async function handleAction(intent: DocumentCopyIntent) {
    setPendingIntent(intent);

    try {
      await performDocumentCopyAction({
        intent,
        documentId,
        filename,
        refresh: () => {
          startTransition(() => {
            queryClient.invalidateQueries({
              queryKey: casesQueryKeys.document(caseId, documentId),
            });
          });
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Unable to ${intent} this document right now.`
      );
    } finally {
      setPendingIntent(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        onClick={() => handleAction("print")}
        disabled={pendingIntent !== null}
        aria-label="Print document"
        title="Print document"
      >
        {pendingIntent === "print" ? (
          <RiLoader4Line className="size-6 animate-spin" />
        ) : (
          <RiPrinterLine className="size-6" />
        )}
      </Button>
      <Button
        type="button"
        size="icon-lg"
        onClick={() => handleAction("download")}
        disabled={pendingIntent !== null}
        aria-label="Download document"
        title="Download document"
      >
        {pendingIntent === "download" ? (
          <RiLoader4Line className="size-6 animate-spin" />
        ) : (
          <RiDownload2Line className="size-6" />
        )}
      </Button>
    </div>
  );
}
