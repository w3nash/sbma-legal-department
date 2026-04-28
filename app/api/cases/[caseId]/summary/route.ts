import { NextResponse } from "next/server";
import { DocumentStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth-guards";
import type { CaseSummary } from "@/lib/case-data";
import { MembershipRole, UserRole } from "@/lib/constants";
import { canViewCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      members: { select: { userId: true, role: true } },
      _count: { select: { documents: true, members: true } },
    },
  });

  if (!c) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
  }

  const membership =
    c.members.find((member) => member.userId === user.id) ?? null;
  const canView = canViewCase(
    { role: user.role as UserRole },
    membership ? { role: membership.role as MembershipRole } : null
  );

  if (!canView) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const processingDocumentCount = await prisma.document.count({
    where: { caseId, status: DocumentStatus.processing },
  });

  const summary: CaseSummary = {
    documentCount: c._count.documents,
    memberCount: c._count.members,
    processingDocumentCount,
  };

  return NextResponse.json(summary);
}
