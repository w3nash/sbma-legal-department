"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RiAlertLine,
  RiCloseLine,
  RiFileList3Line,
  RiInboxLine,
  RiUploadLine,
} from "@remixicon/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SUPPORTED_FILE_ACCEPT } from "@/lib/document-upload";
import { cn } from "@/lib/utils";
import { useUploadDocumentsMutation } from "@/hooks/use-cases";

function createSubmissionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function UploadDocumentsForm({
  caseId,
  formId = "upload-documents-form",
  hideSubmit = false,
  onUploadingChange,
}: {
  caseId: string;
  formId?: string;
  hideSubmit?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const router = useRouter();
  const uploadMutation = useUploadDocumentsMutation(caseId);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);
  const submissionIdRef = useRef(createSubmissionId());
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const uploading = uploadMutation.isPending;

  useEffect(() => {
    onUploadingChange?.(uploading);

    return () => {
      onUploadingChange?.(false);
    };
  }, [onUploadingChange, uploading]);

  function mergeFiles(nextFiles: File[]) {
    setFiles((current) => {
      const merged = [...current];

      for (const file of nextFiles) {
        const alreadySelected = merged.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (!alreadySelected) {
          merged.push(file);
        }
      }

      return merged;
    });
    setError(null);
  }

  function removeFile(fileToRemove: File) {
    setFiles((current) =>
      current.filter(
        (file) =>
          !(
            file.name === fileToRemove.name &&
            file.size === fileToRemove.size &&
            file.lastModified === fileToRemove.lastModified
          )
      )
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 || uploading || submitLockRef.current) return;

    submitLockRef.current = true;
    setError(null);
    const selectedFiles = [...files];

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
    formData.set("submissionId", submissionIdRef.current);
    setFiles([]);

    try {
      const result = await uploadMutation.mutateAsync(formData);
      if (result.duplicate) return;

      toast.success(
        `Queued ${result.createdCount} document${
          result.createdCount === 1 ? "" : "s"
        } for processing`
      );
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (err) {
      setFiles(selectedFiles);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      submitLockRef.current = false;
      submissionIdRef.current = createSubmissionId();
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${formId}-files`}>Files</Label>
        <input
          ref={inputRef}
          id={`${formId}-files`}
          type="file"
          className="sr-only"
          multiple
          accept={SUPPORTED_FILE_ACCEPT}
          disabled={uploading}
          onChange={(event) => {
            mergeFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!uploading) setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const nextTarget = event.relatedTarget;
            if (
              nextTarget instanceof Node &&
              event.currentTarget.contains(nextTarget)
            ) {
              return;
            }
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            if (uploading) return;
            mergeFiles(Array.from(event.dataTransfer.files ?? []));
          }}
          className={cn(
            "group rounded-2xl border border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
            uploading && "cursor-not-allowed opacity-60"
          )}
          aria-disabled={uploading}
        >
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full border transition-colors",
                isDragActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground"
              )}
            >
              <RiInboxLine className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Drop documents here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Office, OpenDocument, and RTF files up to 50 MB each
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Select Files
            </Button>
          </div>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="rounded-md border">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <RiFileList3Line className="size-4 text-muted-foreground" />
              {files.length} selected
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => setFiles([])}
            >
              Clear
            </Button>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto p-3">
            {files.map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-md bg-accent/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="block truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={uploading}
                  onClick={() => removeFile(file)}
                  aria-label={`Remove ${file.name}`}
                >
                  <RiCloseLine className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <RiAlertLine />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!hideSubmit ? (
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={files.length === 0 || uploading}>
            <RiUploadLine className="mr-1 size-4" />
            {uploading ? "Uploading..." : "Upload Documents"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => router.push(`/cases/${caseId}`)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </form>
  );
}
