import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { MembershipRole, UserRole } from "@/lib/constants";
import { canViewCase } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: { members: { select: { userId: true, role: true } } },
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

  const members = await prisma.caseMember.findMany({
    where: { caseId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(members);
}
