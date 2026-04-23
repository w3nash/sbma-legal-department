# Admin Features Implementation Plan

**Goal:** Admin layout guard, user management (list, create, toggle active), audit log viewer with pagination.

---

## Task 3.1: Admin Layout Guard

**Files:**
- Create: `app/admin/layout.tsx`

**Step 1: Write layout**

```tsx
// app/admin/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as any;
  if (user?.role !== "admin") redirect("/cases");
  return <div className="space-y-6">{children}</div>;
}
```

**Step 2: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat: add admin layout guard"
```

---

## Task 3.2: Admin Users Page — Table

**Files:**
- Create: `app/admin/users/page.tsx`

**Step 1: Install shadcn components**

Run: `npx shadcn@latest add table badge`

**Step 2: Write users page (server component)**

```tsx
// app/admin/users/page.tsx
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
import { CreateUserForm } from "./_components/CreateUserForm";
import { ToggleActiveButton } from "./_components/ToggleActiveButton";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
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
                <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell>{u.isActive ? "Yes" : "No"}</TableCell>
              <TableCell>
                <ToggleActiveButton userId={u.id} isActive={u.isActive} />
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
git add app/admin/users/page.tsx
git commit -m "feat: add admin users list page"
```

---

## Task 3.3: Create User Form (TanStack Form + Zod + shadcn)

**Files:**
- Create: `app/admin/users/_components/CreateUserForm.tsx`
- Create: `app/admin/users/_actions.ts`

**Step 1: Write Server Action**

```typescript
// app/admin/users/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/lib/schemas";
import { z } from "zod";

export async function createUserAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { email, name, role, password } = parsed.data;

  await auth.api.signUpEmail({
    body: { email, name, password },
    headers: await headers(),
  });

  await prisma.user.update({
    where: { email },
    data: { role },
  });

  revalidatePath("/admin/users");
}
```

**Step 2: Write CreateUserForm**

```tsx
// app/admin/users/_components/CreateUserForm.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { createUserSchema } from "@/lib/schemas";
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
import { createUserAction } from "../_actions";

export function CreateUserForm() {
  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      role: "member" as "admin" | "member",
      password: "",
    },
    validatorAdapter: zodValidator(),
    validators: {
      onSubmit: createUserSchema,
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
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors ? (
              <p className="text-sm text-red-500">
                {field.state.meta.errors.join(", ")}
              </p>
            ) : null}
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
            {field.state.meta.errors ? (
              <p className="text-sm text-red-500">
                {field.state.meta.errors.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Field name="role">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Role</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v as "admin" | "member")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
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
            {field.state.meta.errors ? (
              <p className="text-sm text-red-500">
                {field.state.meta.errors.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Subscribe>
        {(state) => (
          <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
            {state.isSubmitting ? "Creating..." : "Create User"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

**Step 3: Install shadcn Select**

Run: `npx shadcn@latest add select`

**Step 4: Commit**

```bash
git add app/admin/users/_components/CreateUserForm.tsx app/admin/users/_actions.ts
git commit -m "feat: add admin create user form with TanStack Form + Zod"
```

---

## Task 3.4: Toggle User Active

**Files:**
- Create: `app/admin/users/_components/ToggleActiveButton.tsx`

**Step 1: Write toggle action (add to _actions.ts)**

```typescript
// app/admin/users/_actions.ts
export async function toggleUserActive(userId: string, isActive: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath("/admin/users");
}
```

**Step 2: Write ToggleActiveButton**

```tsx
// app/admin/users/_components/ToggleActiveButton.tsx
"use client";

import { Button } from "@/components/ui/button";
import { toggleUserActive } from "../_actions";

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

**Step 3: Commit**

```bash
git add app/admin/users/_components/ToggleActiveButton.tsx app/admin/users/_actions.ts
git commit -m "feat: add toggle user active button"
```

---

## Task 3.5: Audit Logs Page

**Files:**
- Create: `app/admin/audit-logs/page.tsx`

**Step 1: Install shadcn Pagination**

Run: `npx shadcn@latest add pagination`

**Step 2: Write audit logs page**

```tsx
// app/admin/audit-logs/page.tsx
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
      <h1 className="text-2xl font-bold">Audit Logs</h1>
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
git add app/admin/audit-logs
git commit -m "feat: add audit log viewer with pagination"
```
