"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createUserAction,
  toggleUserActive,
} from "@/app/(app)/admin/users/_actions";
import { adminQueryKeys } from "@/lib/query-keys";
import type { UserRow } from "@/app/(app)/admin/users/columns";
import type { AuditLogRow } from "@/app/(app)/admin/audit-logs/columns";

export { adminQueryKeys };

export type AuditLogsResponse = {
  logs: AuditLogRow[];
  total: number;
  totalPages: number;
  pageNum: number;
};

export function useUsersQuery() {
  return useQuery({
    queryKey: adminQueryKeys.users,
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<UserRow[]>;
    },
  });
}

export function useAuditLogsQuery(page: number) {
  return useQuery({
    queryKey: adminQueryKeys.auditLogs(page),
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json() as Promise<AuditLogsResponse>;
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => createUserAction(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users });
      toast.success("User created successfully.");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create user."
      );
    },
  });
}

export function useToggleUserActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleUserActive(userId, isActive),
    onMutate: async ({ userId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: adminQueryKeys.users });
      const previous = queryClient.getQueryData<UserRow[]>(adminQueryKeys.users);
      queryClient.setQueryData<UserRow[]>(adminQueryKeys.users, (old = []) =>
        old.map((u) => (u.id === userId ? { ...u, isActive } : u))
      );
      return { previous };
    },
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? "User activated." : "User deactivated.");
    },
    onError: (err, _, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(adminQueryKeys.users, context.previous);
      toast.error(
        err instanceof Error ? err.message : "Failed to update user status."
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users });
    },
  });
}
