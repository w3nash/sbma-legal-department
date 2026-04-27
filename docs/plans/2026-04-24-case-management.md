# Case Management Implementation Plan

**Goal:** Case CRUD, case detail with document list, case member management.

**Key dependencies:**
- `lib/auth-guards.ts` — use `requireAuth()` / `requireAdmin()` helpers throughout
- `lib/constants.ts` — `UserRole`, `MembershipRole`, `Route` enums
- `lib/permissions.ts` — `canViewCase`, `canUploadToCase`, `canManageCase`
- `lib/schemas.ts` — `createCaseSchema`, `addMemberSchema`
- Components go in `components/cases/` and import via `@/components/cases/`

---

## Task 4.1: Case Server Actions

**Files:**
- Create: `app/(app)/cases/_actions.ts`

```typescript
// app/(app)/cases/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";
import { revalidatePath } from "next/cache";
import { createCaseSchema, addMemberSchema } from "@/lib/schemas";
import { Route } from "@/lib/constants";

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

export async function addCaseMember(caseId: string, formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = addMemberSchema.safeParse({ ...raw, caseId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await prisma.caseMember.create({
    data: { caseId, userId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function removeCaseMember(caseId: string, userId: string) {
  await requireAdmin();
  await prisma.caseMember.deleteMany({ where: { caseId, userId } });
  revalidatePath(`/cases/${caseId}`);
}
```

**Commit**

```bash
git add app/\(app\)/cases/_actions.ts
git commit -m "feat: add case server actions"
```

---

## Task 4.2: Create Case Page

**Files:**
- Create: `app/(app)/cases/new/page.tsx`

> **TanStack Form v1 + Zod v4 (Standard Schema):** Pass Zod schemas directly to `validators: { onBlur: schema }` — no `zodValidator()` adapter needed.

```tsx
// app/(app)/cases/new/page.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { createCaseSchema } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction } from "@/app/(app)/cases/_actions";
import { useRouter } from "next/navigation";
import { Route } from "@/lib/constants";

export default function NewCasePage() {
  const router = useRouter();
  const form = useForm({
    defaultValues: { title: "", caseNumber: "", description: "" },
    validators: { onBlur: createCaseSchema },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("title", value.title);
      if (value.caseNumber) fd.append("caseNumber", value.caseNumber);
      if (value.description) fd.append("description", value.description);
      await createCaseAction(fd);
      router.push(Route.Cases);
    },
  });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">New Case</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="title">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Title</Label>
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
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="caseNumber">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Case Number (optional)</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Description (optional)</Label>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Case"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
```

**Install Textarea**

Run: `npx shadcn@latest add textarea`

**Commit**

```bash
git add app/\(app\)/cases/new/page.tsx
git commit -m "feat: add case creation page with TanStack Form + Zod Standard Schema"
```

---

## Task 4.3: Case List Page + CaseCard Component

**Files:**
- Create: `app/(app)/cases/page.tsx`
- Create: `components/cases/CaseCard.tsx`

**Step 1: Write CaseCard**

```tsx
// components/cases/CaseCard.tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CaseCardProps {
  id: string;
  title: string;
  caseNumber?: string | null;
  status: string;
  documentCount: number;
}

export function CaseCard({
  id,
  title,
  caseNumber,
  status,
  documentCount,
}: CaseCardProps) {
  return (
    <Link href={`/cases/${id}`}>
      <Card className="hover:bg-accent">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {caseNumber && (
            <p className="text-sm text-muted-foreground">{caseNumber}</p>
          )}
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={status === "open" ? "default" : "secondary"}>
            {status}
          </Badge>
          <span>&middot;</span>
          <span>{documentCount} documents</span>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Write Cases Page**

```tsx
// app/(app)/cases/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { UserRole, Route } from "@/lib/constants";
import { CaseCard } from "@/components/cases/CaseCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CasesPage() {
  const session = await requireAuth();
  const isAdmin = session.user.role === UserRole.Admin;

  const cases = await prisma.case.findMany({
    where: isAdmin ? undefined : { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/cases/new">New Case</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <CaseCard
            key={c.id}
            id={c.id}
            title={c.title}
            caseNumber={c.caseNumber}
            status={c.status}
            documentCount={c._count.documents}
          />
        ))}
      </div>
    </div>
  );
}
```

**Commit**

```bash
git add app/\(app\)/cases/page.tsx components/cases/CaseCard.tsx
git commit -m "feat: add case list page and CaseCard component"
```

---

## Task 4.4: Case Detail Page

**Files:**
- Create: `app/(app)/cases/[caseId]/page.tsx`

```tsx
// app/(app)/cases/[caseId]/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { redirect, notFound } from "next/navigation";
import { canViewCase, canUploadToCase, canManageCase } from "@/lib/permissions";
import { UserRole } from "@/lib/constants";
import { DocumentList } from "@/components/cases/DocumentList";
import { CaseMemberManager } from "@/components/cases/CaseMemberManager";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) notFound();

  const membership = c.members.find((m) => m.userId === user.id) ?? null;
  if (!canViewCase({ role: user.role }, membership ? { role: membership.role } : null)) {
    redirect("/cases");
  }

  const isAdmin = canManageCase({ role: user.role });
  const canUpload = canUploadToCase(
    { role: user.role },
    membership ? { role: membership.role } : null
  );

  const allUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        {c.caseNumber && (
          <p className="text-muted-foreground">{c.caseNumber}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        {(isAdmin || canUpload) && (
          <Button asChild>
            <Link href={`/cases/${caseId}/upload`}>Upload Document</Link>
          </Button>
        )}
      </div>

      <DocumentList documents={c.documents} caseId={caseId} />

      {isAdmin && (
        <CaseMemberManager
          caseId={caseId}
          members={c.members}
          allUsers={allUsers}
        />
      )}
    </div>
  );
}
```

**Commit**

```bash
git add app/\(app\)/cases/\[caseId\]/page.tsx
git commit -m "feat: add case detail page with permission checks"
```

---

## Task 4.5: DocumentList Component

**Files:**
- Create: `components/cases/DocumentList.tsx`

```tsx
// components/cases/DocumentList.tsx
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Document {
  id: string;
  controlNumber: string;
  originalFilename: string;
  createdAt: Date;
  fileSizeBytes: bigint | null;
}

export function DocumentList({
  documents,
  caseId,
}: {
  documents: Document[];
  caseId: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Control #</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Size</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-mono text-xs">
              {doc.controlNumber}
            </TableCell>
            <TableCell>
              <Link
                href={`/cases/${caseId}/documents/${doc.id}`}
                className="hover:underline"
              >
                {doc.originalFilename}
              </Link>
            </TableCell>
            <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>{formatBytes(Number(doc.fileSizeBytes ?? 0))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
```

**Commit**

```bash
git add components/cases/DocumentList.tsx
git commit -m "feat: add DocumentList component"
```

---

## Task 4.6: CaseMemberManager Component

**Files:**
- Create: `components/cases/CaseMemberManager.tsx`

```tsx
// components/cases/CaseMemberManager.tsx
"use client";

import { useState } from "react";
import { addCaseMember, removeCaseMember } from "@/app/(app)/cases/_actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MembershipRole } from "@/lib/constants";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function CaseMemberManager({
  caseId,
  members,
  allUsers,
}: {
  caseId: string;
  members: Member[];
  allUsers: User[];
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<typeof MembershipRole[keyof typeof MembershipRole]>(
    MembershipRole.Viewer
  );

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.user.id === u.id)
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Case Members</h3>
      <div className="flex gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={role}
          onValueChange={(v) =>
            setRole(v as typeof MembershipRole[keyof typeof MembershipRole])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MembershipRole.Viewer}>Viewer</SelectItem>
            <SelectItem value={MembershipRole.Uploader}>Uploader</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => {
            const fd = new FormData();
            fd.append("userId", userId);
            fd.append("role", role);
            addCaseMember(caseId, fd);
            setUserId("");
          }}
          disabled={!userId}
        >
          Add
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                {m.user.name} ({m.user.email})
              </TableCell>
              <TableCell className="capitalize">{m.role}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCaseMember(caseId, m.user.id)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Commit**

```bash
git add components/cases/CaseMemberManager.tsx
git commit -m "feat: add CaseMemberManager component"
```
