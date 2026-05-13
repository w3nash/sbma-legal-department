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
import { uploadDocuments } from "@/app/(app)/cases/[caseId]/upload/_actions";
import type { CaseDocumentRow, CaseSummary } from "@/lib/case-data";
import type { DocumentDetailData } from "@/lib/document-detail";
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
    refetchInterval: 5000,
  });
}

export function useCaseSummaryQuery(caseId: string, initialData?: CaseSummary) {
  return useQuery({
    queryKey: casesQueryKeys.summary(caseId),
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/summary`);
      if (!res.ok) throw new Error("Failed to fetch case summary");
      return res.json() as Promise<CaseSummary>;
    },
    initialData,
    refetchInterval: (query) =>
      query.state.data?.processingDocumentCount ? 2000 : 5000,
  });
}

export function useCaseDocumentsQuery(
  caseId: string,
  initialData?: CaseDocumentRow[]
) {
  return useQuery({
    queryKey: casesQueryKeys.documents(caseId),
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<CaseDocumentRow[]>;
    },
    initialData,
    refetchInterval: (query) =>
      query.state.data?.some((document) => document.status === "processing")
        ? 2000
        : 5000,
  });
}

export function useCaseDocumentDetailQuery(
  caseId: string,
  documentId: string,
  initialData?: DocumentDetailData
) {
  return useQuery({
    queryKey: casesQueryKeys.document(caseId, documentId),
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) throw new Error("Failed to fetch document detail");
      return res.json() as Promise<DocumentDetailData>;
    },
    initialData,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2000 : 5000,
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

export function useUploadDocumentsMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => uploadDocuments(caseId, formData),
    onSuccess: async (result) => {
      if (result.duplicate) return;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: casesQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: casesQueryKeys.documents(caseId),
        }),
        queryClient.invalidateQueries({
          queryKey: casesQueryKeys.summary(caseId),
        }),
      ]);
    },
  });
}

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
    onMutate: async ({ userIds, role }) => {
      await queryClient.cancelQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
      const previousMembers = queryClient.getQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId)
      );
      const availableUsers =
        queryClient.getQueryData<AvailableUser[]>(
          casesQueryKeys.availableUsers(caseId)
        ) ?? [];
      const newMembers: CaseMemberRow[] = userIds
        .map((id) => availableUsers.find((u) => u.id === id))
        .filter((u): u is AvailableUser => !!u)
        .map((u) => ({ id: `optimistic-${u.id}`, user: u, role }));
      queryClient.setQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId),
        (old = []) => [...old, ...newMembers]
      );
      return { previousMembers };
    },
    onSuccess: (_, { userIds }) => {
      const count = userIds.length;
      toast.success(`Added ${count} member${count > 1 ? "s" : ""}`);
    },
    onError: (err, _, context) => {
      if (context?.previousMembers !== undefined)
        queryClient.setQueryData(
          casesQueryKeys.members(caseId),
          context.previousMembers
        );
      toast.error(err instanceof Error ? err.message : "Failed to add members");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: casesQueryKeys.availableUsers(caseId),
      });
    },
  });
}

export function useRemoveCaseMemberMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeCaseMember(caseId, userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
      const previous = queryClient.getQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId)
      );
      queryClient.setQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId),
        (old = []) => old.filter((m) => m.user.id !== userId)
      );
      return { previous };
    },
    onSuccess: () => toast.success("Member removed"),
    onError: (err, _, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(
          casesQueryKeys.members(caseId),
          context.previous
        );
      toast.error(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: casesQueryKeys.availableUsers(caseId),
      });
    },
  });
}

export function useUpdateMemberRoleMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(caseId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
      const previous = queryClient.getQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId)
      );
      queryClient.setQueryData<CaseMemberRow[]>(
        casesQueryKeys.members(caseId),
        (old = []) =>
          old.map((m) => (m.user.id === userId ? { ...m, role } : m))
      );
      return { previous };
    },
    onSuccess: () => toast.success("Role updated"),
    onError: (err, _, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(
          casesQueryKeys.members(caseId),
          context.previous
        );
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: casesQueryKeys.members(caseId),
      });
    },
  });
}

export function useUpdateCaseMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => updateCaseAction(caseId, fd),
    onMutate: async (fd) => {
      await queryClient.cancelQueries({ queryKey: casesQueryKeys.list() });
      const previous = queryClient.getQueryData<CaseRow[]>(
        casesQueryKeys.list()
      );
      queryClient.setQueryData<CaseRow[]>(casesQueryKeys.list(), (old = []) =>
        old.map((c) =>
          c.id === caseId
            ? {
                ...c,
                title: (fd.get("title") as string) ?? c.title,
                caseNumber:
                  (fd.get("caseNumber") as string | null) ?? c.caseNumber,
                status: (fd.get("status") as string) ?? c.status,
              }
            : c
        )
      );
      return { previous };
    },
    onError: (err, _, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(casesQueryKeys.list(), context.previous);
      toast.error(err instanceof Error ? err.message : "Failed to update case");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: casesQueryKeys.list() });
    },
  });
}
