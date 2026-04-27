"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CaseTabNavProps {
  caseId: string;
  documentCount: number;
  memberCount: number;
}

export function CaseTabNav({
  caseId,
  documentCount,
  memberCount,
}: CaseTabNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/cases/${caseId}`,
      label: "Documents",
      count: documentCount,
      exact: true,
    },
    {
      href: `/cases/${caseId}/members`,
      label: "Members",
      count: memberCount,
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
          </Link>
        );
      })}
    </div>
  );
}
