# Auth, Layout & UI Foundation Implementation Plan

**Goal:** Login page, auth session provider, sidebar navigation, TanStack Query provider, permission helpers, audit helper.

---

## Task 2.1: Install shadcn Components & TanStack Libraries

**Step 1: Install via shadcn CLI**

Run: `npx shadcn@latest add card input button label separator avatar`

**Step 2: Install TanStack deps**

Run: `bun add @tanstack/react-query @tanstack/react-form zod @tanstack/zod-form-adapter react-pdf`

**Step 3: Commit**

```bash
git add components package.json bun.lock
git commit -m "deps: add shadcn UI, TanStack Form/Query, react-pdf"
```

---

## Task 2.2: Permission Helpers + Tests

**Files:**
- Create: `lib/permissions.ts`
- Create: `lib/__tests__/permissions.test.ts`

**Step 1: Write failing test**

```typescript
// lib/__tests__/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canViewCase, canUploadToCase, canManageCase } from "../permissions";

describe("permissions", () => {
  it("admin can view any case", () => {
    expect(canViewCase({ role: "admin" }, null)).toBe(true);
  });
  it("member cannot view unassigned case", () => {
    expect(canViewCase({ role: "member" }, null)).toBe(false);
  });
  it("viewer cannot upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "viewer" })).toBe(false);
  });
  it("uploader can upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "uploader" })).toBe(true);
  });
});
```

**Step 2: Run (expect fail)**

Run: `bun test lib/__tests__/permissions.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// lib/permissions.ts
export interface UserContext {
  role: "admin" | "member";
}

export interface MembershipContext {
  role: "viewer" | "uploader";
}

export function canViewCase(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === "admin") return true;
  return membership !== null;
}

export function canUploadToCase(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === "admin") return true;
  return membership?.role === "uploader";
}

export function canDownloadDocument(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === "admin") return true;
  return membership !== null;
}

export function canManageCase(user: UserContext): boolean {
  return user.role === "admin";
}

export function canManageUsers(user: UserContext): boolean {
  return user.role === "admin";
}
```

**Step 4: Run (expect pass)**

Run: `bun test lib/__tests__/permissions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/permissions.ts lib/__tests__/permissions.test.ts
git commit -m "feat: add permission helpers with tests"
```

---

## Task 2.3: Audit Log Helper

**Files:**
- Create: `lib/audit.ts`

**Step 1: Write implementation**

```typescript
// lib/audit.ts
import { prisma } from "./prisma";
import { AuditAction } from "@prisma/client";

export async function logAudit(opts: {
  action: AuditAction;
  userId: string;
  documentId?: string;
  caseId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
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
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
```

**Step 2: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: add audit log helper"
```

---

## Task 2.4: Zod Schemas (Shared)

**Files:**
- Create: `lib/schemas.ts`

**Step 1: Write schemas**

```typescript
// lib/schemas.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["admin", "member"]),
  password: z.string().min(8),
});

export const createCaseSchema = z.object({
  title: z.string().min(1),
  caseNumber: z.string().optional(),
  description: z.string().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["viewer", "uploader"]),
});

export const uploadDocumentSchema = z.object({
  file: z.instanceof(File),
});
```

**Step 2: Commit**

```bash
git add lib/schemas.ts
git commit -m "feat: add shared Zod schemas"
```

---

## Task 2.5: Auth Session Provider

**Files:**
- Create: `app/_components/AuthProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write AuthProvider**

```tsx
// app/_components/AuthProvider.tsx
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
```

**Step 2: Update layout.tsx**

```tsx
// app/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AuthProvider } from "./_components/AuthProvider";
import { QueryProvider } from "./_components/QueryProvider";
import { Sidebar } from "./_components/Sidebar";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role,
        image: session.user.image,
      }
    : null;

  return (
    <html>
      <body className="flex min-h-screen">
        <AuthProvider user={user}>
          <QueryProvider>
            <Sidebar />
            <main className="flex-1 p-6">{children}</main>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add app/_components/AuthProvider.tsx app/layout.tsx
git commit -m "feat: add AuthProvider with server session hydration"
```

---

## Task 2.6: TanStack Query Provider

**Files:**
- Create: `app/_components/QueryProvider.tsx`

**Step 1: Write QueryProvider**

```tsx
// app/_components/QueryProvider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Commit**

```bash
git add app/_components/QueryProvider.tsx
git commit -m "feat: add TanStack Query provider"
```

---

## Task 2.7: Sidebar Navigation

**Files:**
- Create: `app/_components/Sidebar.tsx`

**Step 1: Write Sidebar**

```tsx
// app/_components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useAuthUser } from "./AuthProvider";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
  const user = useAuthUser();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="w-64 border-r p-4">
      <div className="mb-4 font-bold">SBMA Legal</div>
      <nav className="space-y-1">
        <Link href="/cases" className="block rounded p-2 hover:bg-accent">
          Cases
        </Link>
        {isAdmin && (
          <>
            <Separator className="my-2" />
            <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
              Admin
            </div>
            <Link
              href="/admin/users"
              className="block rounded p-2 hover:bg-accent"
            >
              Users
            </Link>
            <Link
              href="/admin/audit-logs"
              className="block rounded p-2 hover:bg-accent"
            >
              Audit Logs
            </Link>
          </>
        )}
        <Separator className="my-2" />
        <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
          Account
        </div>
        <Link href="/profile" className="block rounded p-2 hover:bg-accent">
          Profile
        </Link>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="w-full rounded p-2 text-left hover:bg-accent"
          >
            Logout
          </button>
        </form>
      </nav>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add app/_components/Sidebar.tsx
git commit -m "feat: add sidebar navigation with role-based links"
```

---

## Task 2.8: Login Page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Write login page**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      window.location.href = "/cases";
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SBMA Legal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page with shadcn components"
```
