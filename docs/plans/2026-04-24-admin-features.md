# Admin Features Implementation Plan

**Goal:** Admin layout guard, user management (list, create, toggle active), audit log viewer with pagination.

**Key dependencies:**
- `better-auth` v1.6+ with admin plugin (`better-auth/plugins`)
- `@tanstack/react-form` v1.29+ (Standard Schema support built-in — no adapter needed)
- `zod` v4 (implements Standard Schema natively)
- `lib/auth-guards.ts` — use `requireAdmin()` / `requireAuth()` helpers throughout
- `lib/constants.ts` — `UserRole`, `MembershipRole`, `Route` enums
- `lib/schemas.ts` — shared Zod schemas

---

## Task 3.0: Add Admin Plugin to BetterAuth

The admin plugin enables `auth.api.createUser()`, `auth.api.listUsers()`, and `auth.api.setRole()` on the server. Without it, user creation requires a two-step `signUpEmail` + `prisma.user.update` workaround.

**Files:**
- Modify: `lib/auth.ts`

**Step 1: Update auth config**

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";
import prisma from "@/lib/prisma";
import { env } from "@/env";
import { UserRole } from "./constants";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: UserRole.Member,
        input: false, // prevent users from setting their own role
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  plugins: [adminPlugin()],
});

// Type-safe session shape including additionalFields
export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
```

> **Note on `input: false`:** This prevents users from passing `role` or `isActive` through the sign-up form. Only server-side admin operations can set these fields.

**Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add better-auth admin plugin and export Session type"
```

---

## Task 3.1: Admin Layout Guard

**Files:**
- Modify: `app/(app)/admin/layout.tsx`

**Step 1: Update layout**

```tsx
// app/(app)/admin/layout.tsx
import { requireAdmin } from "@/lib/auth-guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // redirects to /cases if not admin

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Administration</h1>
      {children}
    </div>
  );
}
```

> **Why `requireAdmin()`?** The guard in `lib/auth-guards.ts` centralises the session check + redirect logic. Inline `auth.api.getSession()` + manual redirect in each layout duplicates this logic and drifts over time.

**Step 2: Commit**

```bash
git add app/\(app\)/admin/layout.tsx
git commit -m "feat: use requireAdmin guard in admin layout"
```

---

## Task 3.2: Admin Users Page — Table

**Files:**
- Modify: `app/(app)/admin/users/page.tsx`

**Step 1: Install shadcn components**

Run: `npx shadcn@latest add table badge`

**Step 2: Write users page (server component)**

```tsx
// app/(app)/admin/users/page.tsx
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";
import { UserRole } from "@/lib/constants";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Users</h2>
      <CreateUserForm />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === UserRole.Admin ? "default" : "secondary"}>
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell>{u.isActive ? "Yes" : "No"}</TableCell>
              <TableCell>
                <ToggleActiveButton userId={u.id} isActive={Boolean(u.isActive)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/\(app\)/admin/users/page.tsx
git commit -m "feat: add admin users list page"
```

---

## Task 3.3: Create User Form (TanStack Form + Zod + shadcn)

**Files:**
- Create: `components/admin/CreateUserForm.tsx`
- Create: `app/(app)/admin/users/_actions.ts`

> **TanStack Form v1 + Zod v4 (Standard Schema):** As of `@tanstack/react-form` v1, Zod schemas implement the Standard Schema spec natively. Pass them directly to `validators: { onBlur: schema }` — no `zodValidator()` adapter or `@tanstack/zod-form-adapter` package needed.

**Step 1: Write Server Action**

```typescript
// app/(app)/admin/users/_actions.ts
"use server";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createUserSchema } from "@/lib/schemas";
import { Route } from "@/lib/constants";

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { email, name, role, password } = parsed.data;

  // auth.api.createUser() (admin plugin) creates user + sets role in one step.
  // Preferred over signUpEmail() + prisma.user.update() — goes through
  // better-auth's event lifecycle and avoids a race-condition window.
  // headers() passed so better-auth can verify the caller's admin session internally.
  await auth.api.createUser({
    body: { email, name, password, role },
    headers: await headers(),
  });

  revalidatePath(Route.AdminUsers);
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath(Route.AdminUsers);
}
```

**Step 2: Install shadcn Select**

Run: `npx shadcn@latest add select`

**Step 3: Write CreateUserForm**

```tsx
// components/admin/CreateUserForm.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { createUserSchema } from "@/lib/schemas";
import { UserRole } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction } from "@/app/(app)/admin/users/_actions";

export function CreateUserForm() {
  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      role: UserRole.Member as typeof UserRole[keyof typeof UserRole],
      password: "",
    },
    // Standard Schema: pass Zod schema directly — no zodValidator() adapter needed.
    // onBlur validates when a field loses focus — feedback after the user finishes
    // typing rather than on every keystroke (onChange) or only at submission (onSubmit).
    validators: {
      onBlur: createUserSchema,
    },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("email", value.email);
      fd.append("name", value.name);
      fd.append("role", value.role);
      fd.append("password", value.password);
      await createUserAction(fd);
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4 rounded border p-4"
    >
      <h2 className="font-semibold">Create User</h2>

      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-red-500">
                {field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : e.message))
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-red-500">
                {field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : e.message))
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="role">
        {(field) => (
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) =>
                field.handleChange(v as typeof UserRole[keyof typeof UserRole])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Member}>Member</SelectItem>
                <SelectItem value={UserRole.Admin}>Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Password</Label>
            <Input
              id={field.name}
              name={field.name}
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-red-500">
                {field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : e.message))
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      >
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create User"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

> **`form.Subscribe` with `selector`:** Providing a `selector` limits re-renders to only when `canSubmit` or `isSubmitting` changes, rather than on every keystroke. This is the idiomatic v1 pattern.

**Step 4: Commit**

```bash
git add components/admin/CreateUserForm.tsx app/\(app\)/admin/users/_actions.ts
git commit -m "feat: add admin create user form with TanStack Form + Zod Standard Schema"
```

---

## Task 3.4: Toggle User Active Button

**Files:**
- Create: `components/admin/ToggleActiveButton.tsx`

```tsx
// components/admin/ToggleActiveButton.tsx
"use client";

import { Button } from "@/components/ui/button";
import { toggleUserActive } from "@/app/(app)/admin/users/_actions";

export function ToggleActiveButton({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  return (
    <form
      action={async () => {
        await toggleUserActive(userId, !isActive);
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}
```

**Commit**

```bash
git add components/admin/ToggleActiveButton.tsx
git commit -m "feat: add toggle user active button"
```

---

## Task 3.5: Audit Logs Page

**Files:**
- Create: `app/(app)/admin/audit-logs/page.tsx`

**Step 1: Install shadcn Pagination**

Run: `npx shadcn@latest add pagination`

**Step 2: Write audit logs page**

```tsx
// app/(app)/admin/audit-logs/page.tsx
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page || "1", 10));
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        user: { select: { name: true, email: true } },
        document: { select: { controlNumber: true } },
        case: { select: { title: true } },
      },
      orderBy: { timestamp: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Audit Logs</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {new Date(log.timestamp).toLocaleString()}
              </TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>{log.user?.name}</TableCell>
              <TableCell>{log.case?.title}</TableCell>
              <TableCell className="font-mono text-xs">
                {log.document?.controlNumber}
              </TableCell>
              <TableCell>{log.ipAddress}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination>
        <PaginationContent>
          {pageNum > 1 && (
            <PaginationItem>
              <PaginationPrevious href={`?page=${pageNum - 1}`} />
            </PaginationItem>
          )}
          <PaginationItem>
            <span className="px-4 py-2 text-sm">
              Page {pageNum} of {totalPages}
            </span>
          </PaginationItem>
          {pageNum < totalPages && (
            <PaginationItem>
              <PaginationNext href={`?page=${pageNum + 1}`} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/\(app\)/admin/audit-logs
git commit -m "feat: add audit log viewer with pagination"
```
