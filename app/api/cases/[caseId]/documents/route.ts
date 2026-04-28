import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guards";
import type { CaseDocumentRow } from "@/lib/case-data";
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
    include: {
      members: { select: { userId: true, role: true } },
      documents: { orderBy: { createdAt: "desc" } },
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

  return NextResponse.json(documents);
}
