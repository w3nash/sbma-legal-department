"use client";

import { useSession } from "@/lib/auth-client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string | null;
};

export function useAuthUser() {
  const { data: session, isPending } = useSession();

  if (isPending) return undefined;
  if (!session) return null;

  return session.user as unknown as SessionUser;
}
