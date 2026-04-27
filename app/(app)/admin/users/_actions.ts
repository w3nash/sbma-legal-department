"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-guards";
import { Route, UserRole } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/lib/schemas";

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { email, name, role, password } = parsed.data;

  await auth.api.createUser({
    body: {
      email,
      name,
      password,
      role,
    },
    headers: await headers(),
  });

  revalidatePath(Route.AdminUsers);
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const adminSession = await requireAdmin();

  if (!isActive && adminSession.user.id === userId) {
    throw new Error("You cannot deactivate your own account");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (!isActive && targetUser.role === UserRole.Admin && targetUser.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: UserRole.Admin, isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw new Error("You cannot deactivate the last active admin");
    }
  }

  const requestHeaders = await headers();

  if (isActive) {
    await auth.api.unbanUser({ body: { userId }, headers: requestHeaders });
  } else {
    await auth.api.banUser({
      body: { userId, banReason: "Deactivated by administrator" },
      headers: requestHeaders,
    });
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });

  revalidatePath(Route.AdminUsers);
}
