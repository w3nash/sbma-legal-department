# Infrastructure Setup Implementation Plan

**Goal:** Bootstrap the Docker Compose stack, Prisma ORM, BetterAuth, S3/Redis clients, and encryption layer.

**Architecture:** Next.js 16 runs inside a Docker container with LibreOffice. PostgreSQL, MinIO, and Redis run as sibling containers. Prisma manages schema and migrations. BetterAuth uses the Prisma adapter.

---

## Task 1.1: Docker Compose Stack

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Modify: `.gitignore`

**Step 1: Write Dockerfile**

```dockerfile
FROM node:22-alpine AS base
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
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://sbma:sbma@db:5432/sbmalegal
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: http://localhost:3000
      S3_ENDPOINT: http://storage:9000
      S3_ACCESS_KEY_ID: minioadmin
      S3_SECRET_ACCESS_KEY: minioadmin
      S3_BUCKET: sbma-legal
      S3_REGION: us-east-1
      S3_FORCE_PATH_STYLE: "true"
      REDIS_URL: redis://cache:6379
      MASTER_ENCRYPTION_KEY: ${MASTER_ENCRYPTION_KEY}
      NODE_ENV: production
    depends_on: [db, storage, cache]
    volumes: [/tmp:/tmp]
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: sbma
      POSTGRES_PASSWORD: sbma
      POSTGRES_DB: sbmalegal
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  storage:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]
  cache:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
  miniodata:
```

**Step 3: Add `.env` to `.gitignore`**

```text
.env
.env.local
```

**Step 4: Verify**

Run: `docker compose up -d`
Expected: `docker compose ps` shows 4 running containers.

**Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile .gitignore
git commit -m "infra: add Docker Compose stack with Postgres, MinIO, Redis"
```

---

## Task 1.2: Prisma Schema & Initial Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Modify: `package.json`

**Step 1: Install deps**

Run: `bun add prisma @prisma/client`

**Step 2: Write schema.prisma**

```prisma
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

  accounts    Account[]
  sessions    Session[]
  uploadedDocuments Document[] @relation("UploadedBy")
  caseMemberships   CaseMember[]
  auditLogs         AuditLog[]
}

enum UserRole {
  admin
  member
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope             String?
  idToken           String?
  password          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
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

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
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

```text
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

**Step 4: Add postinstall script**

Modify `package.json`:

```json
"postinstall": "prisma generate"
```

**Step 5: Run migration**

Run: `bunx prisma migrate dev --name init`
Expected: Migration created, DB schema matches.

**Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example package.json
git commit -m "infra: add Prisma schema and initial migration"
```

---

## Task 1.3: BetterAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/prisma.ts`
- Create: `app/api/auth/[...all]/route.ts`

**Step 1: Install deps**

Run: `bun add better-auth`

**Step 2: Write lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 3: Write lib/auth.ts**

```typescript
import { betterAuth } from "better-auth";
import { PrismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: PrismaAdapter(prisma),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "member" },
      isActive: { type: "boolean", defaultValue: true },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7 },
});
```

**Step 4: Write auth API route**

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

**Step 5: Commit**

```bash
git add lib/auth.ts lib/prisma.ts app/api/auth
git commit -m "feat: setup BetterAuth with Prisma adapter"
```

---

## Task 1.4: S3/MinIO & Redis Clients

**Files:**
- Create: `lib/s3.ts`
- Create: `lib/redis.ts`

**Step 1: Install deps**

Run: `bun add @aws-sdk/client-s3 ioredis`
Run: `bun add -D @types/ioredis`

**Step 2: Write lib/s3.ts**

```typescript
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
import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
```

**Step 4: Commit**

```bash
git add lib/s3.ts lib/redis.ts package.json
git commit -m "infra: add S3 and Redis clients"
```

---

## Task 1.5: Encryption Helpers + Tests

**Files:**
- Create: `lib/crypto.ts`
- Create: `lib/__tests__/crypto.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

**Step 1: Install deps**

Run: `bun add -D vitest`

**Step 2: Add test script**

Modify `package.json`:

```json
"test": "vitest"
```

**Step 3: Write vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

**Step 4: Write failing test**

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

**Step 5: Run (expect fail)**

Run: `bun test lib/__tests__/crypto.test.ts`
Expected: FAIL

**Step 6: Write lib/crypto.ts**

```typescript
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
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(fileKey, "base64")),
    cipher.final(),
  ]);
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
  const key = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return key.toString("base64");
}
```

**Step 7: Run (expect pass)**

Run: `bun test lib/__tests__/crypto.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add lib/crypto.ts lib/__tests__/crypto.test.ts vitest.config.ts package.json
git commit -m "feat: add AES-256-GCM file encryption with tests"
```
