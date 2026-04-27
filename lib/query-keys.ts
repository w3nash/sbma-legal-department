export const adminQueryKeys = {
  users: ["admin", "users"] as const,
  auditLogs: (page: number) => ["admin", "audit-logs", page] as const,
};

export const casesQueryKeys = {
  list: () => ["cases", "list"] as const,
  members: (caseId: string) => ["cases", caseId, "members"] as const,
  availableUsers: (caseId: string) => ["cases", caseId, "available-users"] as const,
};
