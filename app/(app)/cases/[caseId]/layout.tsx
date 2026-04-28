import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { notFound, redirect } from "next/navigation";
import { canViewCase, canManageCase } from "@/lib/permissions";
import { UserRole, type MembershipRole } from "@/lib/constants";
import { DocumentStatus } from "@/generated/prisma/client";
import Link from "next/link";
import { CaseTabNav } from "@/components/cases/CaseTabNav";
import { CaseDetailShell } from "@/components/cases/CaseDetailShell";
import { LegalFolderIcon } from "@/components/cases/CaseCard";
import { Button } from "@/components/ui/button";
import { RiSettings4Line } from "@remixicon/react";

const folderColor: Record<string, string> = {
  open: "text-primary",
  closed: "text-slate-400 dark:text-slate-500",
  archived: "text-amber-600/90",
};

export default async function CaseDetailLayout({
  params,
  children,
  modal,
}: {
  params: Promise<{ caseId: string }>;
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { caseId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      members: { select: { userId: true, role: true } },
      _count: { select: { documents: true, members: true } },
    },
  });

  if (!c) notFound();

  const membership = c.members.find((m) => m.userId === user.id) ?? null;
  const userRole = user.role as UserRole;
  const memberRole = membership
    ? { role: membership.role as MembershipRole }
    : null;

  if (!canViewCase({ role: userRole }, memberRole)) {
    redirect("/cases");
  }

  const isAdmin = canManageCase({ role: userRole });
  const folderClass = folderColor[c.status] ?? folderColor.open;

  const createdAt = c.createdAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const processingDocumentCount = await prisma.document.count({
    where: { caseId, status: DocumentStatus.processing },
  });
  const initialSummary = {
    documentCount: c._count.documents,
    memberCount: c._count.members,
    processingDocumentCount,
  };

  const caseHeader = (
    <div className="flex shrink-0 items-center gap-2">
      <div className={folderClass}>
        <LegalFolderIcon className="h-auto w-14 sm:w-16 md:w-20 lg:w-24" />
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[11px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
              {c.caseNumber ? c.caseNumber : "(No case number)"}
            </span>
          </div>
          <h1 className="text-xl leading-tight font-bold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-0.5 line-clamp-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {c.description ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground/50">Created {createdAt}</p>
        </div>

        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/cases/${caseId}/settings`} />}
          >
            <RiSettings4Line className="mr-1.5 size-4" />
            Settings
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <CaseDetailShell
      caseHeader={caseHeader}
      caseTabs={
        <CaseTabNav caseId={caseId} initialSummary={initialSummary} />
      }
      modal={modal}
    >
      {children}
    </CaseDetailShell>
  );
}
