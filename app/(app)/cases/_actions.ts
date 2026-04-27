"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { revalidatePath } from "next/cache";
import { createCaseSchema, updateCaseSchema } from "@/lib/schemas";
import { Route, MembershipRole } from "@/lib/constants";

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

export async function getAvailableUsers(caseId: string) {
  await requireAdmin();
  const memberIds = await prisma.caseMember
    .findMany({ where: { caseId }, select: { userId: true } })
    .then((m) => m.map((x) => x.userId));
  return prisma.user.findMany({
    where: { isActive: true, id: { notIn: memberIds } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function addCaseMembersAction(
  caseId: string,
  userIds: string[],
  role: string
) {
  await requireAdmin();
  if (!Object.values(MembershipRole).includes(role as MembershipRole)) {
    throw new Error("Invalid role");
  }
  await prisma.caseMember.createMany({
    data: userIds.map((userId) => ({
      caseId,
      userId,
      role: role as MembershipRole,
    })),
    skipDuplicates: true,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function removeCaseMember(caseId: string, userId: string) {
  await requireAdmin();
  await prisma.caseMember.deleteMany({ where: { caseId, userId } });
  revalidatePath(`/cases/${caseId}`);
}

export async function updateMemberRole(
  caseId: string,
  userId: string,
  role: string
) {
  await requireAdmin();

  if (!Object.values(MembershipRole).includes(role as MembershipRole)) {
    throw new Error("Invalid role");
  }

  await prisma.caseMember.update({
    where: { caseId_userId: { caseId, userId } },
    data: { role: role as MembershipRole },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function updateCaseAction(caseId: string, formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateCaseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await prisma.case.update({
    where: { id: caseId },
    data: {
      title: parsed.data.title,
      caseNumber: parsed.data.caseNumber,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath(Route.Cases);
}
