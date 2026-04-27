import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  await requireAdmin();
  const { caseId } = await params;

  const members = await prisma.caseMember.findMany({
    where: { caseId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(members);
}
