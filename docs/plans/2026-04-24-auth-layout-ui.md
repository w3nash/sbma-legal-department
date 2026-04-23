# Auth, Layout & UI Foundation Implementation Plan

**Goal:** Login page, auth session provider, sidebar navigation, TanStack Query provider, permission helpers, audit helper.

---

## Task 2.1: Install TanStack Libraries

> **Note:** shadcn components (`card`, `input`, `button`, `label`, `separator`, `avatar`) are already installed.

**Step 1: Install TanStack deps**

Run: `npm install @tanstack/react-query @tanstack/react-form zod react-pdf`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add TanStack Form/Query, zod, react-pdf"
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

Run: `npm test -- lib/__tests__/permissions.test.ts`
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

Run: `npm test -- lib/__tests__/permissions.test.ts`
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
- Create: `app/components/AuthProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write AuthProvider**

```tsx
// app/components/AuthProvider.tsx
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
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "./components/AuthProvider";
import { QueryProvider } from "./components/QueryProvider";
import { AppSidebar } from "./components/AppSidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider user={user}>
            <QueryProvider>
              <AppSidebar />
              <main className="flex-1 p-6">{children}</main>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add app/components/AuthProvider.tsx app/layout.tsx
git commit -m "feat: add AuthProvider with server session hydration"
```

---

## Task 2.6: TanStack Query Provider

**Files:**
- Create: `app/components/QueryProvider.tsx`

**Step 1: Write QueryProvider**

```tsx
// app/components/QueryProvider.tsx
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
git add app/components/QueryProvider.tsx
git commit -m "feat: add TanStack Query provider"
```

---

## Task 2.7: Sidebar Navigation

> **Note:** Use the existing rich shadcn/ui `Sidebar` component from `components/ui/sidebar.tsx` (SidebarProvider, useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, etc.).

**Files:**
- Create: `app/components/AppSidebar.tsx`

**Step 1: Write AppSidebar**

```tsx
// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthUser } from "./AuthProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const user = useAuthUser();
  const isAdmin = user?.role === "admin";
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <span className="text-sm font-bold">SL</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">SBMA Legal</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Document Portal
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/cases"}>
                    <Link href="/cases">Cases</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/admin/users"}
                    >
                      <Link href="/admin/users">Users</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/admin/audit-logs"}
                    >
                      <Link href="/admin/audit-logs">Audit Logs</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.image ?? ""} alt={user?.name} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0) ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name ?? "Guest"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <form action="/api/auth/signout" method="post">
                      <button type="submit" className="w-full text-left">
                        Logout
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
```

**Step 2: Commit**

```bash
git add app/components/AppSidebar.tsx
git commit -m "feat: add AppSidebar using rich shadcn/ui sidebar component"
```

---

## Task 2.8: Login Page

> **Design:** 2-column layout on desktop (left: branding/hero, right: login form), 1-column on mobile (form only). Use Next.js `useRouter` for navigation. Use shadcn `Card`, `Input`, `Button`, `Label`, `Separator`.

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Write login page**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      router.push("/cases");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left column - Branding (hidden on mobile) */}
      <div className="relative hidden flex-col justify-between bg-muted p-10 text-muted-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-medium text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          SBMA Legal
        </div>
        <div className="space-y-6">
          <blockquote className="space-y-2">
            <p className="text-lg leading-relaxed">
              &ldquo;Secure document management for legal professionals.
              Protecting sensitive case files with enterprise-grade
              encryption.&rdquo;
            </p>
          </blockquote>
        </div>
        <div className="text-sm">
          &copy; {new Date().getFullYear()} SBMA Legal. All rights reserved.
        </div>
      </div>

      {/* Right column - Login form (full width on mobile) */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-lg font-medium">SBMA Legal</span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <Card className="w-full max-w-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Welcome back
              </CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <Separator className="my-4" />

                <p className="text-center text-sm text-muted-foreground">
                  Protected by enterprise-grade security
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add responsive login page with Next.js router and shadcn UI"
```
