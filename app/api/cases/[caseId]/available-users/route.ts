import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/constants";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  await requireAdmin();
  const { caseId } = await params;

  const memberIds = await prisma.caseMember
    .findMany({ where: { caseId }, select: { userId: true } })
    .then((m) => m.map((x) => x.userId));

  const users = await prisma.user.findMany({
    where: { isActive: true, role: UserRole.Member, id: { notIn: memberIds } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
