import { UploadDocumentsForm } from "@/components/cases/UploadDocumentsForm";

export default async function UploadDocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Documents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add one or more PDF, Office, OpenDocument, or RTF files.
        </p>
      </div>

      <UploadDocumentsForm caseId={caseId} />
    </div>
  );
}
