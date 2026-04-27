"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useUsersQuery } from "@/hooks/use-admin";
import { UsersDataTable } from "./data-table";

function UsersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="border-b px-4 py-3">
          <div className="grid grid-cols-4 gap-4">
            {["w-16", "w-20", "w-12", "w-14"].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 last:border-0">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

export function UsersContent() {
  const { data: users = [], isLoading, error } = useUsersQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manage Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create accounts, assign roles, and activate or deactivate user access across the system.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading ? (
        <UsersTableSkeleton />
      ) : (
        <UsersDataTable data={users} />
      )}
    </div>
  );
}
