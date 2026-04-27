import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { casesQueryKeys } from "@/lib/query-keys";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { UserRole } from "@/lib/constants";
import { CasesView } from "@/components/cases/CasesView";

export default async function CasesPage() {
  const session = await requireAuth();
  const isAdmin = session.user.role === UserRole.Admin;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: casesQueryKeys.list(),
    queryFn: async () => {
      const raw = await prisma.case.findMany({
        where: isAdmin
          ? undefined
          : { members: { some: { userId: session.user.id } } },
        include: { _count: { select: { documents: true } } },
        orderBy: { createdAt: "desc" },
      });
      return raw.map((c) => ({
        id: c.id,
        title: c.title,
        caseNumber: c.caseNumber,
        status: c.status,
        documentCount: c._count.documents,
        createdAt: c.createdAt.toISOString(),
      }));
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CasesView isAdmin={isAdmin} />
    </HydrationBoundary>
  );
}
