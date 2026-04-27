import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { UserRole } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await requireAuth();
  const isAdmin = session.user.role === UserRole.Admin;

  const raw = await prisma.case.findMany({
    where: isAdmin ? undefined : { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    raw.map((c) => ({
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      status: c.status,
      documentCount: c._count.documents,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}
