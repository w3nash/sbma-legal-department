"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const routeBreadcrumbs: Record<string, BreadcrumbSegment[]> = {
  [Route.Cases]: [{ label: "Cases" }],
  [Route.AdminUsers]: [{ label: "Administration" }, { label: "Users" }],
  [Route.AdminUsersCreate]: [{ label: "Administration" }, { label: "Users", href: Route.AdminUsers }, { label: "Create" }],
  [Route.AdminAuditLogs]: [{ label: "Administration" }, { label: "Audit Logs" }],
  [Route.Profile]: [{ label: "Profile" }],
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const segments = routeBreadcrumbs[pathname] ?? [];

  if (segments.length === 0) return null;

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
