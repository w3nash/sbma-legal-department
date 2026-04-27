import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { casesQueryKeys } from "@/lib/query-keys";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { notFound } from "next/navigation";
import { canManageCase } from "@/lib/permissions";
import { UserRole } from "@/lib/constants";
import { CaseMemberManager } from "@/components/cases/CaseMemberManager";
import { MembersReadOnlyTable } from "@/components/cases/MembersReadOnlyTable";
import { RiGroup3Line } from "@remixicon/react";

export default async function CaseMembersPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const session = await requireAuth();
  const userRole = session.user.role as UserRole;
  const isAdmin = canManageCase({ role: userRole });

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!c) notFound();

  if (isAdmin) {
    const queryClient = getQueryClient();
    await queryClient.prefetchQuery({
      queryKey: casesQueryKeys.members(caseId),
      queryFn: () => c.members,
    });

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CaseMemberManager caseId={caseId} />
      </HydrationBoundary>
    );
  }

  if (c.members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div
          className="mb-6 flex h-[72px] w-[72px] animate-in items-center justify-center rounded-2xl border border-chart-2/15 text-chart-2 duration-700 fill-mode-both zoom-in-95 fade-in"
          style={{
            background: "color-mix(in oklch, var(--chart-2) 7%, transparent)",
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklch, var(--chart-2) 20%, transparent) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
            backgroundPosition: "3px 3px",
          }}
        >
          <RiGroup3Line className="size-9" />
        </div>
        <div className="mb-4 flex animate-in items-center gap-3 delay-150 duration-500 fill-mode-both fade-in">
          <div className="h-px w-10 bg-border" />
          <div className="h-[5px] w-[5px] rotate-45 bg-chart-2/35" />
          <div className="h-px w-10 bg-border" />
        </div>
        <div className="animate-in space-y-1.5 delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
          <p className="text-[10.5px] font-semibold tracking-[0.18em] text-muted-foreground/55 uppercase">
            Case Members
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            No members assigned
          </h2>
        </div>
        <p className="mt-2 max-w-[240px] animate-in text-sm leading-relaxed text-muted-foreground delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
          No members have been assigned to this case yet.
        </p>
      </div>
    );
  }

  return <MembersReadOnlyTable members={c.members} />;
}
