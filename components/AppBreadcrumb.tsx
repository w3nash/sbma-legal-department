"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isCaseDocumentDetailPath } from "@/components/cases/CaseDetailShell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Route } from "@/lib/constants";

type BreadcrumbSegment = { label: string; href?: string };

const AppBreadcrumbOverrideContext = createContext<{
  customSegments: BreadcrumbSegment[] | null;
  setCustomSegments: (segments: BreadcrumbSegment[] | null) => void;
} | null>(null);

const routeBreadcrumbs: Record<string, BreadcrumbSegment[]> = {
  [Route.Cases]: [{ label: "Cases" }],
  [Route.AdminUsers]: [{ label: "Administration" }, { label: "Users" }],
  [Route.AdminUsersCreate]: [
    { label: "Administration" },
    { label: "Users", href: Route.AdminUsers },
    { label: "Create" },
  ],
  [Route.AdminAuditLogs]: [
    { label: "Administration" },
    { label: "Audit Logs" },
  ],
  [Route.Profile]: [{ label: "Profile" }],
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const params = useParams<{ caseId?: string }>();
  const overrideContext = useContext(AppBreadcrumbOverrideContext);
  const customSegments = overrideContext?.customSegments ?? null;

  // Dynamic breadcrumb for case detail routes
  if (params.caseId) {
    if (customSegments && customSegments.length > 0) {
      return <BreadcrumbSegments segments={customSegments} />;
    }

    if (isCaseDocumentDetailPath(pathname)) {
      return (
        <BreadcrumbSegments
          segments={[
            { label: "Cases", href: Route.Cases },
            { label: "Documents", href: `/cases/${params.caseId}` },
            { label: "Document" },
          ]}
        />
      );
    }

    const segments: BreadcrumbSegment[] = [
      { label: "Cases", href: Route.Cases },
    ];

    if (pathname.includes("/upload")) {
      segments.push({ label: "Upload" });
    } else if (pathname.includes("/members")) {
      segments.push({ label: "Members" });
    } else if (pathname.includes("/settings")) {
      segments.push({ label: "Settings" });
    } else {
      segments.push({ label: "Documents" });
    }

    return <BreadcrumbSegments segments={segments} />;
  }

  const segments = routeBreadcrumbs[pathname] ?? [];
  if (segments.length === 0) return null;

  return <BreadcrumbSegments segments={segments} />;
}

function BreadcrumbSegments({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={segment.label}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={segment.href ?? "#"} />}>
                    {segment.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppBreadcrumbProvider({
  children,
  initialSegments = null,
}: {
  children: React.ReactNode;
  initialSegments?: BreadcrumbSegment[] | null;
}) {
  const [customSegments, setCustomSegments] = useState<
    BreadcrumbSegment[] | null
  >(initialSegments);

  const value = useMemo(
    () => ({ customSegments, setCustomSegments }),
    [customSegments]
  );

  return (
    <AppBreadcrumbOverrideContext.Provider value={value}>
      {children}
    </AppBreadcrumbOverrideContext.Provider>
  );
}

export function HeaderBreadcrumbOverride({
  segments,
}: {
  segments: BreadcrumbSegment[];
}) {
  const context = useContext(AppBreadcrumbOverrideContext);

  useEffect(() => {
    context?.setCustomSegments(segments);

    return () => {
      context?.setCustomSegments(null);
    };
  }, [context, segments]);

  return null;
}
