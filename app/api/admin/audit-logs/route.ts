import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== UserRole.Admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseInt(searchParams.get("page") || "1", 10);
  const pageNum = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        user: { select: { name: true, email: true } },
        document: { select: { controlNumber: true } },
        case: { select: { title: true } },
      },
      orderBy: { timestamp: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    logs,
    total,
    totalPages: Math.ceil(total / pageSize),
    pageNum,
  });
}
