"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogsQuery } from "@/hooks/use-admin";
import { columns } from "./columns";
import { AuditLogsDataTable } from "./data-table";

function AuditLogsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="border-b px-4 py-3">
          <div className="grid grid-cols-6 gap-4">
            {["w-24", "w-20", "w-16", "w-16", "w-20", "w-12"].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 last:border-0">
            <div className="grid grid-cols-6 gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20 font-mono" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

export function AuditLogsContent() {
  const searchParams = useSearchParams();
  const parsed = parseInt(searchParams.get("page") || "1", 10);
  const pageNum = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);

  const { data, isLoading, error } = useAuditLogsQuery(pageNum);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review a complete record of all system activity, user actions, and document events.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading ? (
        <AuditLogsTableSkeleton />
      ) : (
        <AuditLogsDataTable
          columns={columns}
          data={data?.logs ?? []}
          pageNum={data?.pageNum ?? pageNum}
          totalPages={data?.totalPages ?? 1}
        />
      )}
    </div>
  );
}
