"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createCaseAction,
  addCaseMembersAction,
  removeCaseMember,
  updateMemberRole,
  updateCaseAction,
} from "@/app/(app)/cases/_actions";
import { casesQueryKeys } from "@/lib/query-keys";

export type CaseRow = {
  id: string;
  title: string;
  caseNumber: string | null;
  status: string;
  documentCount: number;
  createdAt: string;
};

export type CaseMemberRow = {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
};

export type AvailableUser = {
  id: string;
  name: string;
  email: string;
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useCasesQuery() {
  return useQuery({
    queryKey: casesQueryKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error("Failed to fetch cases");
      return res.json() as Promise<CaseRow[]>;
    },
  });
}

export function useCaseMembersQuery(caseId: string) {
  return useQuery({
    queryKey: casesQueryKeys.members(caseId),
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json() as Promise<CaseMemberRow[]>;
    },
  });
}

export function useAvailableUsersQuery(caseId: string, enabled: boolean) {
  return useQuery({
    queryKey: casesQueryKeys.availableUsers(caseId),
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/available-users`);
      if (!res.ok) throw new Error("Failed to fetch available users");
      return res.json() as Promise<AvailableUser[]>;
    },
    enabled,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateCaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => createCaseAction(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.list() });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create case");
    },
  });
}

export function useAddCaseMembersMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: string }) =>
      addCaseMembersAction(caseId, userIds, role),
    onSuccess: (_, { userIds }) => {
      const count = userIds.length;
      toast.success(`Added ${count} member${count > 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.members(caseId) });
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.availableUsers(caseId) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add members");
    },
  });
}

export function useRemoveCaseMemberMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeCaseMember(caseId, userId),
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.members(caseId) });
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.availableUsers(caseId) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    },
  });
}

export function useUpdateMemberRoleMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(caseId, userId, role),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.members(caseId) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    },
  });
}

export function useUpdateCaseMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => updateCaseAction(caseId, fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.list() });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update case");
    },
  });
}
