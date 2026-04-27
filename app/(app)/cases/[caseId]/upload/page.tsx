"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RiAlertLine, RiUploadLine } from "@remixicon/react";
import { uploadDocument } from "@/app/(app)/cases/[caseId]/upload/_actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UploadPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadDocument(caseId, formData);
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Document
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a PDF, Word, Excel, PowerPoint, OpenDocument, or RTF file.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/rtf"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <RiAlertLine />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!file || uploading}>
            <RiUploadLine className="mr-1 size-4" />
            {uploading ? "Uploading..." : "Upload"}
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
      </form>
    </div>
  );
}
