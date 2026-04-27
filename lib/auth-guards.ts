import { auth } from "./auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Route, UserRole } from "./constants";
import prisma from "./prisma";

export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(Route.Login);
  }

  if (session.user.isActive === false) {
    await prisma.session.deleteMany({
      where: { userId: session.user.id },
    });
    redirect(Route.Login);
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== UserRole.Admin) {
    redirect(Route.Cases);
  }

  return session;
}