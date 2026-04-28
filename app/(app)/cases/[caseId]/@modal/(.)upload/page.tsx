import { UploadDocumentsSheet } from "@/components/cases/UploadDocumentsSheet";

export default async function UploadDocumentsModalPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;

  return <UploadDocumentsSheet caseId={caseId} />;
}
