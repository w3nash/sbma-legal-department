import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { notFound } from "next/navigation";
import type { CaseDocumentRow } from "@/lib/case-data";
import { canUploadToCase } from "@/lib/permissions";
import { UserRole, type MembershipRole } from "@/lib/constants";
import { CaseDocumentsContent } from "./content";

export default async function CaseDocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      members: { select: { userId: true, role: true } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) notFound();

  const membership = c.members.find((m) => m.userId === user.id) ?? null;
  const userRole = user.role as UserRole;
  const memberRole = membership
    ? { role: membership.role as MembershipRole }
    : null;
  const canUpload = canUploadToCase({ role: userRole }, memberRole);

  const documents: CaseDocumentRow[] = c.documents.map((doc) => ({
    id: doc.id,
    controlNumber: doc.controlNumber,
    originalFilename: doc.originalFilename,
    createdAt: doc.createdAt.toISOString(),
    fileSizeBytes:
      doc.fileSizeBytes !== null ? Number(doc.fileSizeBytes) : null,
    status: doc.status,
    processingError: doc.processingError,
  }));

  return (
    <CaseDocumentsContent
      caseId={caseId}
      canUpload={canUpload}
      initialDocuments={documents}
    />
  );
}
