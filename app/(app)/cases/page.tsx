import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { UserRole, Route } from "@/lib/constants";
import { CaseCard } from "@/components/cases/CaseCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CasesPage() {
  const session = await requireAuth();
  const isAdmin = session.user.role === UserRole.Admin;

  const cases = await prisma.case.findMany({
    where: isAdmin ? undefined : { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/cases/new">New Case</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <CaseCard
            key={c.id}
            id={c.id}
            title={c.title}
            caseNumber={c.caseNumber}
            status={c.status}
            documentCount={c._count.documents}
          />
        ))}
      </div>
    </div>
  );
}
