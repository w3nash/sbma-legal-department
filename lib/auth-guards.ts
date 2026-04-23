import { auth } from "./auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Route, UserRole } from "./constants";

export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
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
