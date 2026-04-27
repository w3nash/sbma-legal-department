import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { prisma } from "@/lib/prisma";
import { AuditLogsContent } from "./content";

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const parsed = parseInt(page || "1", 10);
  const pageNum = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: adminQueryKeys.auditLogs(pageNum),
    queryFn: async () => {
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          include: {
            user: { select: { name: true, email: true } },
            document: { select: { controlNumber: true } },
            case: { select: { title: true } },
          },
          orderBy: { timestamp: "desc" },
          skip: (pageNum - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.auditLog.count(),
      ]);
      return { logs, total, totalPages: Math.ceil(total / PAGE_SIZE), pageNum };
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <AuditLogsContent />
      </Suspense>
    </HydrationBoundary>
  );
}
