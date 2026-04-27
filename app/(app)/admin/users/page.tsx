import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { prisma } from "@/lib/prisma";
import { UsersContent } from "./content";

export default async function UsersPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: adminQueryKeys.users,
    queryFn: () => prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersContent />
    </HydrationBoundary>
  );
}
