# Case Management Implementation Plan

**Goal:** Case CRUD, case detail with document list, case member management.

---

## Task 4.1: Create Case Form + Server Action

**Files:**
- Create: `app/cases/_actions.ts`
- Create: `app/cases/new/page.tsx`

**Step 1: Write Server Action**

```typescript
// app/cases/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createCaseSchema, addMemberSchema } from "@/lib/schemas";

export async function createCaseAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }

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

  revalidatePath("/cases");
  return c;
}

export async function addCaseMember(caseId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }

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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }

  await prisma.caseMember.deleteMany({ where: { caseId, userId } });
  revalidatePath(`/cases/${caseId}`);
}
```

**Step 2: Write Create Case Page**

```tsx
// app/cases/new/page.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { createCaseSchema } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction } from "../_actions";
import { useRouter } from "next/navigation";

export default function NewCasePage() {
  const router = useRouter();
  const form = useForm({
    defaultValues: { title: "", caseNumber: "", description: "" },
    validatorAdapter: zodValidator(),
    validators: { onSubmit: createCaseSchema },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("title", value.title);
      if (value.caseNumber) fd.append("caseNumber", value.caseNumber);
      if (value.description) fd.append("description", value.description);
      await createCaseAction(fd);
      router.push("/cases");
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
              {field.state.meta.errors ? (
                <p className="text-sm text-red-500">
                  {field.state.meta.errors.join(", ")}
                </p>
              ) : null}
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

        <form.Subscribe>
          {(state) => (
            <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
              {state.isSubmitting ? "Creating..." : "Create Case"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
```

**Step 3: Install Textarea**

Run: `npx shadcn@latest add textarea`

**Step 4: Commit**

```bash
git add app/cases/_actions.ts app/cases/new
git commit -m "feat: add case creation form and server action"
```

---

## Task 4.2: Case List Page

**Files:**
- Create: `app/cases/page.tsx`
- Create: `app/cases/_components/CaseCard.tsx`

**Step 1: Write CaseCard**

```tsx
// app/cases/_components/CaseCard.tsx
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
// app/cases/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CaseCard } from "./_components/CaseCard";
import { Button } from "@/components/ui/button";

export default async function CasesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const isAdmin = user.role === "admin";

  const cases = await prisma.case.findMany({
    where: isAdmin ? undefined : { members: { some: { userId: user.id } } },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        {isAdmin && (
          <Button asChild>
            <a href="/cases/new">New Case</a>
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

**Step 3: Commit**

```bash
git add app/cases/page.tsx app/cases/_components/CaseCard.tsx
git commit -m "feat: add case list page with cards"
```

---

## Task 4.3: Case Detail Page

**Files:**
- Create: `app/cases/[caseId]/page.tsx`

**Step 1: Write page**

```tsx
// app/cases/[caseId]/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { canViewCase, canUploadToCase, canManageCase } from "@/lib/permissions";
import { DocumentList } from "./_components/DocumentList";
import { CaseMemberManager } from "./_components/CaseMemberManager";
import { Button } from "@/components/ui/button";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user as any;
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
            <a href={`/cases/${caseId}/upload`}>Upload Document</a>
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

**Step 2: Commit**

```bash
git add app/cases/[caseId]/page.tsx
git commit -m "feat: add case detail page with permission checks"
```

---

## Task 4.4: Document List Component

**Files:**
- Create: `app/cases/[caseId]/_components/DocumentList.tsx`

**Step 1: Write component**

```tsx
// app/cases/[caseId]/_components/DocumentList.tsx
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

**Step 2: Commit**

```bash
git add app/cases/[caseId]/_components/DocumentList.tsx
git commit -m "feat: add document list component"
```

---

## Task 4.5: Case Member Manager

**Files:**
- Create: `app/cases/[caseId]/_components/CaseMemberManager.tsx`

**Step 1: Write component**

```tsx
// app/cases/[caseId]/_components/CaseMemberManager.tsx
"use client";

import { useState } from "react";
import { addCaseMember, removeCaseMember } from "../../_actions";
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
  const [role, setRole] = useState<"viewer" | "uploader">("viewer");

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
          onValueChange={(v) => setRole(v as "viewer" | "uploader")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="uploader">Uploader</SelectItem>
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

**Step 2: Commit**

```bash
git add app/cases/[caseId]/_components/CaseMemberManager.tsx
git commit -m "feat: add case member manager with add/remove"
```
