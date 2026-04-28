"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaseSummaryQuery } from "@/hooks/use-cases";
import type { CaseSummary } from "@/lib/case-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CaseTabNavProps {
  caseId: string;
  initialSummary: CaseSummary;
}

export function CaseTabNav({ caseId, initialSummary }: CaseTabNavProps) {
  const pathname = usePathname();
  const { data: summary = initialSummary } = useCaseSummaryQuery(
    caseId,
    initialSummary
  );

  const tabs = [
    {
      href: `/cases/${caseId}`,
      label: "Documents",
      count: summary.documentCount,
      exact: true,
    },
    {
      href: `/cases/${caseId}/members`,
      label: "Members",
      count: summary.memberCount,
      exact: false,
    },
  ];

  return (
    <div className="flex w-full shrink-0 border-b">
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative -mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {tab.count}
            </Badge>
            {tab.exact && summary.processingDocumentCount > 0 ? (
              <span className="size-1.5 rounded-full bg-chart-2" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
