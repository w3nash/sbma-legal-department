import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { canManageCase } from "@/lib/permissions";
import { UserRole } from "@/lib/constants";
import { CaseSettingsForm } from "@/components/cases/CaseSettingsForm";

export default async function CaseSettingsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const session = await requireAuth();
  const userRole = session.user.role as UserRole;

  if (!canManageCase({ role: userRole })) redirect(`/cases/${caseId}`);

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: { title: true, caseNumber: true, description: true, status: true },
  });

  if (!c) notFound();

  return (
    <div className="max-w-lg space-y-6 py-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Case Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the case details, status, and reference number.
        </p>
      </div>

      <CaseSettingsForm
        caseId={caseId}
        title={c.title}
        caseNumber={c.caseNumber}
        description={c.description}
        status={c.status}
        redirectTo={`/cases/${caseId}`}
      />
    </div>
  );
}
