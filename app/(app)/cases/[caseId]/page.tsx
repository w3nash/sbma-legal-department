import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { redirect, notFound } from "next/navigation";
import { canViewCase, canUploadToCase, canManageCase } from "@/lib/permissions";
import { UserRole, type MembershipRole } from "@/lib/constants";
import { DocumentList } from "@/components/cases/DocumentList";
import { CaseMemberManager } from "@/components/cases/CaseMemberManager";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CaseDetailPage({
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
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) notFound();

  const membership = c.members.find((m) => m.userId === user.id) ?? null;
  const userRole = user.role as UserRole;
  const memberRole = membership ? { role: membership.role as MembershipRole } : null;

  if (!canViewCase({ role: userRole }, memberRole)) {
    redirect("/cases");
  }

  const isAdmin = canManageCase({ role: userRole });
  const canUpload = canUploadToCase({ role: userRole }, memberRole);

  const allUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        {c.caseNumber && (
          <p className="text-muted-foreground">{c.caseNumber}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        {(isAdmin || canUpload) && (
          <Button nativeButton={false} render={<Link href={`/cases/${caseId}/upload`} />}>
            Upload Document
          </Button>
        )}
      </div>

      <DocumentList documents={c.documents} caseId={caseId} />

      {isAdmin && (
        <CaseMemberManager
          caseId={caseId}
          members={c.members}
          allUsers={allUsers}
        />
      )}
    </div>
  );
}
