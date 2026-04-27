"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";
import { revalidatePath } from "next/cache";
import { createCaseSchema, addMemberSchema } from "@/lib/schemas";
import { Route } from "@/lib/constants";

export async function createCaseAction(formData: FormData) {
  const session = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCaseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const c = await prisma.case.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
    },
  });

  revalidatePath(Route.Cases);
  return c;
}

export async function addCaseMember(caseId: string, formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = addMemberSchema.safeParse({ ...raw, caseId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await prisma.caseMember.create({
    data: { caseId, userId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function removeCaseMember(caseId: string, userId: string) {
  await requireAdmin();
  await prisma.caseMember.deleteMany({ where: { caseId, userId } });
  revalidatePath(`/cases/${caseId}`);
}
