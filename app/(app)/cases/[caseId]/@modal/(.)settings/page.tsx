import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { notFound } from "next/navigation";
import { CaseSettingsModalWrapper } from "@/components/cases/CaseSettingsModalWrapper";

export default async function CaseSettingsModalPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  await requireAdmin();

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      title: true,
      caseNumber: true,
      description: true,
      status: true,
    },
  });

  if (!c) notFound();

  return (
    <CaseSettingsModalWrapper
      caseId={caseId}
      title={c.title}
      caseNumber={c.caseNumber}
      description={c.description}
      status={c.status}
    />
  );
}
