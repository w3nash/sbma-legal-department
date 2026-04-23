# SBMA Legal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a secure, self-hosted legal document archive with role-based access, forensic watermarking, encryption, and audit logging.

**Architecture:** Next.js 16 App Router with Server Actions and API routes. Docker Compose runs Next.js, PostgreSQL, MinIO, and Redis. Prisma ORM for data. BetterAuth for authentication. Server-side `pdf-lib` for watermarking. LibreOffice headless for file conversion. TanStack Query for client state.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL, Prisma, BetterAuth, MinIO (S3-compatible), Redis, TanStack React Query, pdf-lib, LibreOffice, shadcn/ui, Tailwind CSS v4, Vitest.

---

## Phase 1: Infrastructure & Project Setup

### Task 1.1: Docker Compose Stack

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Modify: `.gitignore`

**Step 1: Write Dockerfile**

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

# Install LibreOffice for document conversion
RUN apk add --no-cache libreoffice

WORKDIR /app

COPY package.json bun.lock ./
RUN corepack enable && corepack prepare bun@latest --activate
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
```

**Step 2: Write docker-compose.yml**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://sbma:sbma@db:5432/sbmalegal
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=http://localhost:3000
      - S3_ENDPOINT=http://storage:9000
      - S3_ACCESS_KEY_ID=minioadmin
      - S3_SECRET_ACCESS_KEY=minioadmin
      - S3_BUCKET=sbma-legal
      - S3_REGION=us-east-1
      - S3_FORCE_PATH_STYLE=true
      - REDIS_URL=redis://cache:6379
      - MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY}
      - NODE_ENV=production
    depends_on:
      - db
      - storage
      - cache
    volumes:
      - /tmp:/tmp

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: sbma
      POSTGRES_PASSWORD: sbma
      POSTGRES_DB: sbmalegal
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  storage:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
  miniodata:
```

**Step 3: Add `.env` to `.gitignore`**

```
.env
.env.local
```

**Step 4: Verify Docker works**

Run: `docker compose up -d`
Expected: All 4 containers start. `docker compose ps` shows `app`, `db`, `storage`, `cache` as healthy/running.

**Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile .gitignore
git commit -m "infra: add Docker Compose stack with Postgres, MinIO, Redis"
```

---

### Task 1.2: Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Modify: `package.json`

**Step 1: Install Prisma**

Run: `bun add prisma @prisma/client`
Run: `bun add -D @types/bun`

**Step 2: Write schema.prisma**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  emailVerified Boolean  @default(false)
  image         String?
  role          UserRole @default(member)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  uploadedDocuments Document[] @relation("UploadedBy")
  caseMemberships   CaseMember[]
  auditLogs         AuditLog[]
}

enum UserRole {
  admin
  member
}

model Case {
  id          String     @id @default(uuid())
  title       String
  caseNumber  String?
  description String?
  status      CaseStatus @default(open)
  createdById String
  createdBy   User       @relation(fields: [createdById], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  members   CaseMember[]
  documents Document[]
  auditLogs AuditLog[]
}

enum CaseStatus {
  open
  closed
  archived
}

model CaseMember {
  id     String         @id @default(uuid())
  caseId String
  case   Case           @relation(fields: [caseId], references: [id])
  userId String
  user   User           @relation(fields: [userId], references: [id])
  role   CaseMemberRole @default(viewer)
  createdAt DateTime    @default(now())

  @@unique([caseId, userId])
}

enum CaseMemberRole {
  viewer
  uploader
}

model Document {
  id                String   @id @default(uuid())
  caseId            String
  case              Case     @relation(fields: [caseId], references: [id])
  controlNumber     String   @unique
  originalFilename  String
  storedOriginalKey String
  storedViewerKey   String
  fileSizeBytes     BigInt?
  mimeType          String?
  encryptionKey     String
  uploadedById      String
  uploadedBy        User     @relation("UploadedBy", fields: [uploadedById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  auditLogs AuditLog[]
}

model AuditLog {
  id         String      @id @default(uuid())
  action     AuditAction
  userId     String
  user       User        @relation(fields: [userId], references: [id])
  documentId String?
  document   Document?   @relation(fields: [documentId], references: [id])
  caseId     String?
  case       Case?       @relation(fields: [caseId], references: [id])
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime    @default(now())
  metadata   Json?
}

enum AuditAction {
  UPLOAD
  VIEW
  DOWNLOAD
  PRINT
  DELETE
  SHARE
  LOGIN
  LOGOUT
}
```

**Step 3: Write .env.example**

```
DATABASE_URL=postgresql://sbma:sbma@localhost:5432/sbmalegal
BETTER_AUTH_SECRET=replace_with_32_byte_hex
BETTER_AUTH_URL=http://localhost:3000
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=sbma-legal
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
REDIS_URL=redis://localhost:6379
MASTER_ENCRYPTION_KEY=replace_with_32_byte_base64
```

**Step 4: Add prisma generate to package.json postinstall**

Modify `package.json` scripts:

```json
"postinstall": "prisma generate"
```

**Step 5: Run initial migration**

Run: `bunx prisma migrate dev --name init`
Expected: Migration created in `prisma/migrations/...`. DB schema matches.

**Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example package.json
git commit -m "infra: add Prisma schema and initial migration"
```

---

### Task 1.3: BetterAuth Setup

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Modify: `app/layout.tsx`
- Modify: `prisma/schema.prisma`

**Step 1: Install BetterAuth**

Run: `bun add better-auth`

**Step 2: Extend schema.prisma for BetterAuth tables**

Append to `prisma/schema.prisma`:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt DateTime?
  refreshTokenExpiresAt DateTime?
  scope             String?
  idToken           String?
  password          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Update `User` model to add relations:

```prisma
model User {
  ...existing fields...
  accounts    Account[]
  sessions    Session[]
}
```

**Step 3: Write lib/auth.ts**

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { PrismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: PrismaAdapter(prisma),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
```

**Step 4: Write Prisma client singleton**

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 5: Write auth API route**

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  return auth.handler(request);
}
```

**Step 6: Add auth provider to layout**

```tsx
// app/layout.tsx (add ClientSessionProvider wrapper)
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <html>
      <body>
        <ClientSessionProvider session={session}>
          {children}
        </ClientSessionProvider>
      </body>
    </html>
  );
}
```

**Step 7: Re-run migration for auth tables**

Run: `bunx prisma migrate dev --name add_auth`
Expected: New migration created, DB has auth tables.

**Step 8: Commit**

```bash
git add lib/auth.ts lib/prisma.ts app/api/auth app/layout.tsx prisma/schema.prisma prisma/migrations
git commit -m "feat: setup BetterAuth with Prisma adapter"
```

---

### Task 1.4: S3/MinIO and Redis Clients

**Files:**
- Create: `lib/s3.ts`
- Create: `lib/redis.ts`

**Step 1: Install deps**

Run: `bun add @aws-sdk/client-s3 ioredis`
Run: `bun add -D @types/ioredis`

**Step 2: Write lib/s3.ts**

```typescript
// lib/s3.ts
import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

export const BUCKET_NAME = process.env.S3_BUCKET!;
```

**Step 3: Write lib/redis.ts**

```typescript
// lib/redis.ts
import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
```

**Step 4: Commit**

```bash
git add lib/s3.ts lib/redis.ts package.json
git commit -m "infra: add S3 and Redis clients"
```

---

### Task 1.5: Encryption Helpers (with tests)

**Files:**
- Create: `lib/crypto.ts`
- Create: `lib/__tests__/crypto.test.ts`

**Step 1: Write failing test**

```typescript
// lib/__tests__/crypto.test.ts
import { describe, it, expect } from "vitest";
import { encryptFile, decryptFile, generateFileKey } from "../crypto";

describe("encryption", () => {
  it("encrypts and decrypts a buffer", () => {
    const plaintext = Buffer.from("hello legal world");
    const key = generateFileKey();
    const encrypted = encryptFile(plaintext, key);
    const decrypted = decryptFile(encrypted, key);
    expect(decrypted.toString()).toBe("hello legal world");
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun test lib/__tests__/crypto.test.ts`
Expected: FAIL — `generateFileKey`, `encryptFile`, `decryptFile` not defined.

**Step 3: Write minimal implementation**

```typescript
// lib/crypto.ts
import crypto from "crypto";

const MASTER_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, "base64");

export function generateFileKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

export function encryptFile(plaintext: Buffer, keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptFile(encrypted: Buffer, keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  const iv = encrypted.subarray(0, 16);
  const authTag = encrypted.subarray(16, 32);
  const ciphertext = encrypted.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptKey(fileKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(fileKey, "base64")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptKey(encryptedKeyB64: string): string {
  const encrypted = Buffer.from(encryptedKeyB64, "base64");
  const iv = encrypted.subarray(0, 16);
  const authTag = encrypted.subarray(16, 32);
  const ciphertext = encrypted.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  const key = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return key.toString("base64");
}
```

**Step 4: Add Vitest script to package.json**

Modify `package.json`:

```json
"test": "vitest"
```

**Step 5: Add vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Run: `bun add -D vitest`

**Step 6: Run tests**

Run: `bun test lib/__tests__/crypto.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add lib/crypto.ts lib/__tests__/crypto.test.ts vitest.config.ts package.json
git commit -m "feat: add AES-256-GCM file encryption with tests"
```

---

## Phase 2: Core Domain & Permissions

### Task 2.1: Permission Helpers (with tests)

**Files:**
- Create: `lib/permissions.ts`
- Create: `lib/__tests__/permissions.test.ts`

**Step 1: Write failing test**

```typescript
// lib/__tests__/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canViewCase, canUploadToCase } from "../permissions";

describe("permissions", () => {
  it("admin can view any case", () => {
    expect(canViewCase({ role: "admin" }, null)).toBe(true);
  });

  it("member cannot view unassigned case", () => {
    expect(canViewCase({ role: "member" }, null)).toBe(false);
  });

  it("member can view assigned case", () => {
    expect(canViewCase({ role: "member" }, { role: "viewer" })).toBe(true);
  });

  it("viewer cannot upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "viewer" })).toBe(false);
  });

  it("uploader can upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "uploader" })).toBe(true);
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun test lib/__tests__/permissions.test.ts`
Expected: FAIL — functions not defined.

**Step 3: Write minimal implementation**

```typescript
// lib/permissions.ts
export interface UserContext {
  role: "admin" | "member";
}

export interface MembershipContext {
  role: "viewer" | "uploader";
}

export function canViewCase(user: UserContext, membership: MembershipContext | null): boolean {
  if (user.role === "admin") return true;
  return membership !== null;
}

export function canUploadToCase(user: UserContext, membership: MembershipContext | null): boolean {
  if (user.role === "admin") return true;
  return membership?.role === "uploader";
}

export function canDownloadDocument(user: UserContext, membership: MembershipContext | null): boolean {
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

**Step 4: Run tests**

Run: `bun test lib/__tests__/permissions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/permissions.ts lib/__tests__/permissions.test.ts
git commit -m "feat: add permission helpers with tests"
```

---

### Task 2.2: Audit Log Helper

**Files:**
- Create: `lib/audit.ts`

**Step 1: Write audit helper**

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

## Phase 3: Case Management UI

### Task 3.1: Case List Page

**Files:**
- Create: `app/cases/page.tsx`
- Create: `app/cases/_components/CaseCard.tsx`
- Modify: `app/page.tsx`

**Step 1: Write CaseCard component**

```tsx
// app/cases/_components/CaseCard.tsx
"use client";

import Link from "next/link";

interface CaseCardProps {
  id: string;
  title: string;
  caseNumber?: string | null;
  status: string;
  documentCount: number;
}

export function CaseCard({ id, title, caseNumber, status, documentCount }: CaseCardProps) {
  return (
    <Link href={`/cases/${id}`} className="block rounded-lg border p-4 hover:bg-accent">
      <h3 className="font-semibold">{title}</h3>
      {caseNumber && <p className="text-sm text-muted-foreground">{caseNumber}</p>}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="capitalize">{status}</span>
        <span>&middot;</span>
        <span>{documentCount} documents</span>
      </div>
    </Link>
  );
}
```

**Step 2: Write cases page**

```tsx
// app/cases/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CaseCard } from "./_components/CaseCard";

export default async function CasesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user;
  const isAdmin = (user as any).role === "admin";

  const cases = await prisma.case.findMany({
    where: isAdmin
      ? undefined
      : { members: { some: { userId: user.id } } },
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        {isAdmin && (
          <a href="/cases/new" className="rounded bg-primary px-4 py-2 text-primary-foreground">
            New Case
          </a>
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

**Step 3: Update home page redirect**

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/cases");
}
```

**Step 4: Commit**

```bash
git add app/cases app/page.tsx
git commit -m "feat: add case list page with cards"
```

---

### Task 3.2: Case Detail Page + Member Management

**Files:**
- Create: `app/cases/[caseId]/page.tsx`
- Create: `app/cases/[caseId]/_components/DocumentList.tsx`
- Create: `app/cases/[caseId]/_components/CaseMemberManager.tsx`
- Create: `app/cases/_actions.ts`

**Step 1: Write Server Actions**

```typescript
// app/cases/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function addCaseMember(caseId: string, userId: string, role: "viewer" | "uploader") {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") throw new Error("Unauthorized");

  await prisma.caseMember.create({
    data: { caseId, userId, role },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function removeCaseMember(caseId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") throw new Error("Unauthorized");

  await prisma.caseMember.deleteMany({
    where: { caseId, userId },
  });

  revalidatePath(`/cases/${caseId}`);
}
```

**Step 2: Write DocumentList component**

```tsx
// app/cases/[caseId]/_components/DocumentList.tsx
"use client";

import Link from "next/link";

interface Document {
  id: string;
  controlNumber: string;
  originalFilename: string;
  createdAt: Date;
  fileSizeBytes: bigint | null;
}

export function DocumentList({ documents, caseId }: { documents: Document[]; caseId: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="pb-2 text-left">Control #</th>
          <th className="pb-2 text-left">Filename</th>
          <th className="pb-2 text-left">Date</th>
          <th className="pb-2 text-left">Size</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <tr key={doc.id} className="border-b">
            <td className="py-2 font-mono text-xs">{doc.controlNumber}</td>
            <td className="py-2">
              <Link href={`/cases/${caseId}/documents/${doc.id}`} className="hover:underline">
                {doc.originalFilename}
              </Link>
            </td>
            <td className="py-2">{new Date(doc.createdAt).toLocaleDateString()}</td>
            <td className="py-2">{formatBytes(Number(doc.fileSizeBytes ?? 0))}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

**Step 3: Write CaseMemberManager component**

```tsx
// app/cases/[caseId]/_components/CaseMemberManager.tsx
"use client";

import { useState } from "react";
import { addCaseMember, removeCaseMember } from "../../_actions";

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

export function CaseMemberManager({ caseId, members, allUsers }: { caseId: string; members: Member[]; allUsers: User[] }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"viewer" | "uploader">("viewer");

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Case Members</h3>
      <div className="flex gap-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Select user...</option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="viewer">Viewer</option>
          <option value="uploader">Uploader</option>
        </select>
        <button
          onClick={() => { addCaseMember(caseId, userId, role); setUserId(""); }}
          disabled={!userId}
          className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between text-sm">
            <span>{m.user.name} — <span className="capitalize">{m.role}</span></span>
            <button
              onClick={() => removeCaseMember(caseId, m.user.id)}
              className="text-red-500 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 4: Write case detail page**

```tsx
// app/cases/[caseId]/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { canViewCase, canManageCase } from "@/lib/permissions";
import { DocumentList } from "./_components/DocumentList";
import { CaseMemberManager } from "./_components/CaseMemberManager";

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) notFound();

  const membership = c.members.find((m) => m.userId === user.id) ?? null;
  if (!canViewCase({ role: user.role }, membership ? { role: membership.role } : null)) {
    redirect("/cases");
  }

  const isAdmin = canManageCase({ role: user.role });
  const allUsers = isAdmin ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true } }) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        {c.caseNumber && <p className="text-muted-foreground">{c.caseNumber}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        {(isAdmin || membership?.role === "uploader") && (
          <a href={`/cases/${caseId}/upload`} className="rounded bg-primary px-4 py-2 text-primary-foreground">
            Upload Document
          </a>
        )}
      </div>
      <DocumentList documents={c.documents} caseId={caseId} />

      {isAdmin && <CaseMemberManager caseId={caseId} members={c.members} allUsers={allUsers} />}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add app/cases/
git commit -m "feat: add case detail page with document list and member management"
```

---

## Phase 4: Document Upload & Processing

### Task 4.1: File Conversion Helper

**Files:**
- Create: `lib/convert.ts`

**Step 1: Write conversion helper**

```typescript
// lib/convert.ts
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execFileAsync = promisify(execFile);

const OFFICE_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
];

export function needsConversion(mimeType: string): boolean {
  return OFFICE_MIMES.includes(mimeType);
}

export async function convertToPDF(inputPath: string, mimeType: string): Promise<Buffer> {
  if (!needsConversion(mimeType)) {
    return fs.readFile(inputPath);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-"));
  try {
    await execFileAsync("soffice", [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", tmpDir,
      inputPath,
    ]);

    const basename = path.basename(inputPath, path.extname(inputPath));
    const pdfPath = path.join(tmpDir, basename + ".pdf");
    return fs.readFile(pdfPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
```

**Step 2: Commit**

```bash
git add lib/convert.ts
git commit -m "feat: add LibreOffice-to-PDF conversion helper"
```

---

### Task 4.2: Watermark Helper

**Files:**
- Create: `lib/watermark.ts`
- Create: `lib/__tests__/watermark.test.ts`

**Step 1: Write failing test**

```typescript
// lib/__tests__/watermark.test.ts
import { describe, it, expect } from "vitest";
import { addWatermark } from "../watermark";
import { PDFDocument } from "pdf-lib";

describe("watermark", () => {
  it("adds watermark text to a PDF", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 400]);
    page.drawText("Original", { x: 50, y: 350, size: 20 });
    const original = await pdf.save();

    const watermarked = await addWatermark(Buffer.from(original), "CTRL-123 | John | john@test.com | 192.168.1.1 | 2024-01-01");
    expect(watermarked.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun test lib/__tests__/watermark.test.ts`
Expected: FAIL — `addWatermark` not defined or `pdf-lib` not installed.

**Step 3: Install pdf-lib**

Run: `bun add pdf-lib`
Run: `bun add -D @types/pdf-lib`

**Step 4: Write implementation**

```typescript
// lib/watermark.ts
import { PDFDocument, rgb, degrees } from "pdf-lib";

export async function addWatermark(pdfBuffer: Buffer, text: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: 30,
      y: height - 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
      rotate: degrees(-15),
      opacity: 0.4,
    });
  }

  return Buffer.from(await pdf.save());
}
```

**Step 5: Run tests**

Run: `bun test lib/__tests__/watermark.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/watermark.ts lib/__tests__/watermark.test.ts package.json
git commit -m "feat: add PDF watermark helper with tests"
```

---

### Task 4.3: Upload Server Action

**Files:**
- Create: `app/cases/[caseId]/upload/_actions.ts`
- Create: `app/cases/[caseId]/upload/page.tsx`

**Step 1: Write upload Server Action**

```typescript
// app/cases/[caseId]/upload/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { redis } from "@/lib/redis";
import { encryptFile, encryptKey, generateFileKey } from "@/lib/crypto";
import { convertToPDF } from "@/lib/convert";
import { addWatermark } from "@/lib/watermark";
import { logAudit } from "@/lib/audit";
import { canUploadToCase } from "@/lib/permissions";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import os from "os";
import path from "path";

export async function uploadDocument(caseId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const user = session.user as any;
  const membership = await prisma.caseMember.findUnique({
    where: { caseId_userId: { caseId, userId: user.id } },
  });

  if (!canUploadToCase({ role: user.role }, membership ? { role: membership.role } : null)) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-upload-"));
  const tmpPath = path.join(tmpDir, file.name);
  await fs.writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

  try {
    const pdfBuffer = await convertToPDF(tmpPath, file.type);
    const controlNumber = uuidv4();

    const fileKey = generateFileKey();
    const encryptedKey = encryptKey(fileKey);

    // Encrypt original PDF
    const encryptedOriginal = encryptFile(pdfBuffer, fileKey);
    const originalKey = `documents/${caseId}/${controlNumber}/original.enc`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: originalKey,
      Body: encryptedOriginal,
    }));

    // Generate viewer copy (control number only)
    const viewerWatermark = `Control Number: ${controlNumber}`;
    const viewerPdf = await addWatermark(pdfBuffer, viewerWatermark);
    const encryptedViewer = encryptFile(viewerPdf, fileKey);
    const viewerKey = `documents/${caseId}/${controlNumber}/viewer.enc`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: viewerKey,
      Body: encryptedViewer,
    }));

    // Cache viewer in Redis
    await redis.setex(`viewer:${controlNumber}`, 3600, encryptedViewer.toString("base64"));

    const doc = await prisma.document.create({
      data: {
        caseId,
        controlNumber,
        originalFilename: file.name,
        storedOriginalKey: originalKey,
        storedViewerKey: viewerKey,
        fileSizeBytes: BigInt(file.size),
        mimeType: file.type,
        encryptionKey: encryptedKey,
        uploadedById: user.id,
      },
    });

    await logAudit({
      action: "UPLOAD",
      userId: user.id,
      documentId: doc.id,
      caseId,
      ipAddress: (await headers()).get("x-forwarded-for") || undefined,
    });

    return { success: true, documentId: doc.id };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
```

**Step 2: Install uuid**

Run: `bun add uuid`
Run: `bun add -D @types/uuid`

**Step 3: Write upload page**

```tsx
// app/cases/[caseId]/upload/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { uploadDocument } from "./_actions";

export default function UploadPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await uploadDocument(caseId, formData);
      router.push(`/cases/${caseId}`);
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Upload Document</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add app/cases/[caseId]/upload lib/convert.ts lib/watermark.ts package.json
git commit -m "feat: add document upload with conversion, encryption, and watermarking"
```

---

## Phase 5: Document Viewer & Download

### Task 5.1: Viewer API Route

**Files:**
- Create: `app/api/documents/[documentId]/viewer/route.ts`

**Step 1: Write viewer route**

```typescript
// app/api/documents/[documentId]/viewer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { redis } from "@/lib/redis";
import { decryptFile, decryptKey } from "@/lib/crypto";
import { canViewCase } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const user = session.user as any;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { case: { include: { members: true } } },
  });

  if (!doc) return new NextResponse("Not found", { status: 404 });

  const membership = doc.case.members.find((m) => m.userId === user.id) ?? null;
  if (!canViewCase({ role: user.role }, membership ? { role: membership.role } : null)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Check Redis cache
  const cacheKey = `viewer:${doc.controlNumber}`;
  const cached = await redis.get(cacheKey);
  let pdfBuffer: Buffer;

  if (cached) {
    pdfBuffer = Buffer.from(cached, "base64");
  } else {
    const s3Res = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: doc.storedViewerKey,
    }));
    const encrypted = Buffer.from(await s3Res.Body!.transformToByteArray());
    const fileKey = decryptKey(doc.encryptionKey);
    pdfBuffer = decryptFile(encrypted, fileKey);
    await redis.setex(cacheKey, 3600, pdfBuffer.toString("base64"));
  }

  await logAudit({
    action: "VIEW",
    userId: user.id,
    documentId: doc.id,
    caseId: doc.caseId,
    ipAddress: request.ip || request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.controlNumber}.pdf"`,
    },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/documents
git commit -m "feat: add viewer API route with Redis caching and audit logging"
```

---

### Task 5.2: Download API Route

**Files:**
- Create: `app/api/documents/[documentId]/download/route.ts`

**Step 1: Write download route**

```typescript
// app/api/documents/[documentId]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { redis } from "@/lib/redis";
import { decryptFile, decryptKey } from "@/lib/crypto";
import { addWatermark } from "@/lib/watermark";
import { canDownloadDocument } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const user = session.user as any;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { case: { include: { members: true } } },
  });

  if (!doc) return new NextResponse("Not found", { status: 404 });

  const membership = doc.case.members.find((m) => m.userId === user.id) ?? null;
  if (!canDownloadDocument({ role: user.role }, membership ? { role: membership.role } : null)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Rate limiting
  const rateKey = `download:${user.id}:${documentId}`;
  const current = await redis.incr(rateKey);
  if (current === 1) await redis.expire(rateKey, RATE_LIMIT_WINDOW);
  if (current > RATE_LIMIT_MAX) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const s3Res = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: doc.storedOriginalKey,
  }));
  const encrypted = Buffer.from(await s3Res.Body!.transformToByteArray());
  const fileKey = decryptKey(doc.encryptionKey);
  const pdfBuffer = decryptFile(encrypted, fileKey);

  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const timestamp = new Date().toISOString();
  const watermark = `Control Number: ${doc.controlNumber} | Name: ${user.name} | Email: ${user.email} | IP: ${ip} | Timestamp: ${timestamp}`;
  const watermarkedPdf = await addWatermark(pdfBuffer, watermark);

  await logAudit({
    action: "DOWNLOAD",
    userId: user.id,
    documentId: doc.id,
    caseId: doc.caseId,
    ipAddress: typeof ip === "string" ? ip : undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return new NextResponse(watermarkedPdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.controlNumber}.pdf"`,
    },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/documents
git commit -m "feat: add download API route with unique watermark and rate limiting"
```

---

### Task 5.3: Document Viewer Page

**Files:**
- Create: `app/cases/[caseId]/documents/[documentId]/page.tsx`

**Step 1: Write viewer page**

```tsx
// app/cases/[caseId]/documents/[documentId]/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { canViewCase } from "@/lib/permissions";

export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ caseId: string; documentId: string }>;
}) {
  const { caseId, documentId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const doc = await prisma.document.findUnique({
    where: { id: documentId, caseId },
    include: { case: { include: { members: true } } },
  });

  if (!doc) notFound();

  const membership = doc.case.members.find((m) => m.userId === user.id) ?? null;
  if (!canViewCase({ role: user.role }, membership ? { role: membership.role } : null)) {
    redirect("/cases");
  }

  const viewerUrl = `/api/documents/${documentId}/viewer`;
  const downloadUrl = `/api/documents/${documentId}/download`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{doc.originalFilename}</h1>
          <p className="font-mono text-xs text-muted-foreground">Control #: {doc.controlNumber}</p>
        </div>
        <a
          href={downloadUrl}
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Download
        </a>
      </div>
      <div className="h-[80vh] w-full rounded border">
        <iframe src={viewerUrl} className="h-full w-full" title={doc.originalFilename} />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/cases/[caseId]/documents
git commit -m "feat: add document viewer page with iframe and download link"
```

---

## Phase 6: Admin Features

### Task 6.1: User Management (Admin)

**Files:**
- Create: `app/admin/users/page.tsx`
- Create: `app/admin/users/_actions.ts`
- Create: `app/admin/layout.tsx`

**Step 1: Write admin layout**

```tsx
// app/admin/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as any;
  if (user?.role !== "admin") redirect("/cases");
  return <div className="space-y-6">{children}</div>;
}
```

**Step 2: Write user management actions**

```typescript
// app/admin/users/_actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function createUser(email: string, name: string, role: "admin" | "member", password: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") throw new Error("Unauthorized");

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

export async function toggleUserActive(userId: string, isActive: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as any).role !== "admin") throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath("/admin/users");
}
```

**Step 3: Write users page**

```tsx
// app/admin/users/page.tsx
import { prisma } from "@/lib/prisma";
import { toggleUserActive } from "./_actions";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="pb-2 text-left">Name</th>
            <th className="pb-2 text-left">Email</th>
            <th className="pb-2 text-left">Role</th>
            <th className="pb-2 text-left">Active</th>
            <th className="pb-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.name}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2 capitalize">{u.role}</td>
              <td className="py-2">{u.isActive ? "Yes" : "No"}</td>
              <td className="py-2">
                <form action={async () => { "use server"; await toggleUserActive(u.id, !u.isActive); }}>
                  <button type="submit" className="text-sm text-primary hover:underline">
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add app/admin
git commit -m "feat: add admin user management page"
```

---

### Task 6.2: Audit Log Viewer (Admin)

**Files:**
- Create: `app/admin/audit-logs/page.tsx`

**Step 1: Write audit log page**

```tsx
// app/admin/audit-logs/page.tsx
import { prisma } from "@/lib/prisma";

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
      include: { user: { select: { name: true, email: true } }, document: { select: { controlNumber: true } }, case: { select: { title: true } } },
      orderBy: { timestamp: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="pb-2 text-left">Timestamp</th>
            <th className="pb-2 text-left">Action</th>
            <th className="pb-2 text-left">User</th>
            <th className="pb-2 text-left">Case</th>
            <th className="pb-2 text-left">Document</th>
            <th className="pb-2 text-left">IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="py-2">{new Date(log.timestamp).toLocaleString()}</td>
              <td className="py-2">{log.action}</td>
              <td className="py-2">{log.user?.name}</td>
              <td className="py-2">{log.case?.title}</td>
              <td className="py-2 font-mono text-xs">{log.document?.controlNumber}</td>
              <td className="py-2">{log.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4">
        {pageNum > 1 && <a href={`?page=${pageNum - 1}`} className="text-primary hover:underline">Previous</a>}
        <span>Page {pageNum} of {totalPages}</span>
        {pageNum < totalPages && <a href={`?page=${pageNum + 1}`} className="text-primary hover:underline">Next</a>}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/admin/audit-logs
git commit -m "feat: add audit log viewer with pagination"
```

---

### Task 6.3: Sidebar Navigation

**Files:**
- Create: `app/_components/Sidebar.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write Sidebar**

```tsx
// app/_components/Sidebar.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";

export async function Sidebar() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as any;
  const isAdmin = user?.role === "admin";

  return (
    <aside className="w-64 border-r p-4">
      <nav className="space-y-2">
        <Link href="/cases" className="block rounded p-2 hover:bg-accent">Cases</Link>
        {isAdmin && (
          <>
            <div className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Admin</div>
            <Link href="/admin/users" className="block rounded p-2 hover:bg-accent">Users</Link>
            <Link href="/admin/audit-logs" className="block rounded p-2 hover:bg-accent">Audit Logs</Link>
          </>
        )}
        <div className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Account</div>
        <Link href="/profile" className="block rounded p-2 hover:bg-accent">Profile</Link>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="w-full rounded p-2 text-left hover:bg-accent">Logout</button>
        </form>
      </nav>
    </aside>
  );
}
```

**Step 2: Update layout**

```tsx
// app/layout.tsx
import { Sidebar } from "./_components/Sidebar";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add app/_components/Sidebar.tsx app/layout.tsx
git commit -m "feat: add sidebar navigation with admin links"
```

---

## Phase 7: TanStack Query & Client State

### Task 7.1: Query Provider Setup

**Files:**
- Create: `app/_components/QueryProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Install TanStack Query**

Run: `bun add @tanstack/react-query`

**Step 2: Write QueryProvider**

```tsx
// app/_components/QueryProvider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

**Step 3: Wrap layout**

Modify `app/layout.tsx` to wrap `children` with `QueryProvider`.

**Step 4: Commit**

```bash
git add app/_components/QueryProvider.tsx app/layout.tsx package.json
git commit -m "feat: setup TanStack React Query provider"
```

---

## Phase 8: Testing

### Task 8.1: Integration Tests for Upload Flow

**Files:**
- Create: `lib/__tests__/upload.integration.test.ts`

**Step 1: Write integration test**

```typescript
// lib/__tests__/upload.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../prisma";
import { s3Client, BUCKET_NAME } from "../s3";
import { encryptFile, decryptFile, encryptKey, decryptKey, generateFileKey } from "../crypto";
import { addWatermark } from "../watermark";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

describe("upload integration", () => {
  it("encrypts a PDF and stores in S3, then retrieves and decrypts", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");
    const key = generateFileKey();
    const encrypted = encryptFile(pdfBuffer, key);
    const encryptedKey = encryptKey(key);

    const objectKey = `test/${Date.now()}.enc`;
    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey, Body: encrypted }));

    const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey }));
    const retrieved = Buffer.from(await res.Body!.transformToByteArray());

    const decryptedKey = decryptKey(encryptedKey);
    const decrypted = decryptFile(retrieved, decryptedKey);

    expect(decrypted.toString()).toBe("%PDF-1.4 fake pdf content");
  });
});
```

**Step 2: Commit**

```bash
git add lib/__tests__/upload.integration.test.ts
git commit -m "test: add integration test for S3 encrypt/decrypt flow"
```

---

### Task 8.2: Integration Test for Permissions

**Files:**
- Create: `lib/__tests__/permissions.integration.test.ts`

**Step 1: Write test**

```typescript
// lib/__tests__/permissions.integration.test.ts
import { describe, it, expect } from "vitest";
import { canViewCase, canUploadToCase, canManageCase } from "../permissions";

describe("permissions", () => {
  it("admin can do everything", () => {
    expect(canViewCase({ role: "admin" }, null)).toBe(true);
    expect(canUploadToCase({ role: "admin" }, null)).toBe(true);
    expect(canManageCase({ role: "admin" })).toBe(true);
  });

  it("member without membership cannot view", () => {
    expect(canViewCase({ role: "member" }, null)).toBe(false);
  });

  it("member with viewer role can view but not upload", () => {
    expect(canViewCase({ role: "member" }, { role: "viewer" })).toBe(true);
    expect(canUploadToCase({ role: "member" }, { role: "viewer" })).toBe(false);
  });

  it("member with uploader role can view and upload", () => {
    expect(canViewCase({ role: "member" }, { role: "uploader" })).toBe(true);
    expect(canUploadToCase({ role: "member" }, { role: "uploader" })).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `bun test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add lib/__tests__/permissions.integration.test.ts
git commit -m "test: add permission integration tests"
```

---

## Phase 9: Final Polish

### Task 9.1: Login Page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Write login page**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";

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
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">SBMA Legal</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        <button type="submit" className="w-full rounded bg-primary px-4 py-2 text-primary-foreground">
          Sign In
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page"
```

---

### Task 9.2: Typecheck and Lint

**Files:**
- All files

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: No errors. Fix any issues.

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors. Fix any issues.

**Step 3: Commit fixes**

```bash
git add .
git commit -m "chore: fix types and lint issues"
```

---

## Summary

This plan builds SBMA Legal in 9 phases:

1. **Infrastructure** — Docker Compose, Prisma, BetterAuth, S3/Redis clients, encryption helpers with tests.
2. **Core Domain** — Permission helpers, audit log helper.
3. **Case Management** — Case list, case detail, member management UI.
4. **Upload Pipeline** — LibreOffice conversion, PDF watermarking, encryption, S3 storage.
5. **Viewer & Download** — Cached viewer API, unique watermarked download API, iframe viewer page.
6. **Admin** — User management, audit log viewer, sidebar navigation.
7. **Client State** — TanStack Query provider.
8. **Testing** — Unit and integration tests for crypto, watermarking, permissions, S3 flow.
9. **Polish** — Login page, typecheck, lint.

All tasks are bite-sized (2-5 minutes each) with exact file paths, code, commands, and expected outputs.
