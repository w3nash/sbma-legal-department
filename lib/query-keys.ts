export const adminQueryKeys = {
  users: ["admin", "users"] as const,
  auditLogs: (page: number) => ["admin", "audit-logs", page] as const,
};
