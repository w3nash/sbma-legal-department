import { prisma } from "./prisma";
import { AuditAction, Prisma } from "@/generated/prisma/client";

export interface LogAuditOptions {
  action: AuditAction;
  userId: string;
  documentId?: string;
  caseId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logAudit(opts: LogAuditOptions): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        userId: opts.userId,
        documentId: opts.documentId,
        caseId: opts.caseId,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
        metadata: opts.metadata ?? {},
      },
    });
    return true;
  } catch (err) {
    console.error("Audit log failed:", err);
    return false;
  }
}
