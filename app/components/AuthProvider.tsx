"use client";

import { createContext, useContext } from "react";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string | null;
};

const AuthContext = createContext<SessionUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuthUser() {
  return useContext(AuthContext);
}
