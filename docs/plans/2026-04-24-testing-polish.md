# Testing & Polish Implementation Plan

**Goal:** Integration tests, typecheck, lint, not-found page, optional seed script.

---

## Task 7.1: Upload Integration Test

**Files:**
- Create: `lib/__tests__/upload.integration.test.ts`

**Step 1: Write test**

```typescript
// lib/__tests__/upload.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../prisma";
import { s3Client, BUCKET_NAME } from "../s3";
import { encryptFile, decryptFile, encryptKey, decryptKey, generateFileKey } from "../crypto";
import { addWatermark } from "../watermark";
import { convertToPDF } from "../convert";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import os from "os";
import path from "path";

describe("upload integration", () => {
  it("converts, encrypts, stores, retrieves, and decrypts a document", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");
    const key = generateFileKey();
    const encrypted = encryptFile(pdfBuffer, key);
    const encryptedKey = encryptKey(key);

    const objectKey = `test/${Date.now()}.enc`;
    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey, Body: encrypted })
    );

    const res = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey })
    );
    const retrieved = Buffer.from(await res.Body!.transformToByteArray());

    const decryptedKey = decryptKey(encryptedKey);
    const decrypted = decryptFile(retrieved, decryptedKey);

    expect(decrypted.toString()).toBe("%PDF-1.4 fake pdf content");
  });

  it("adds watermark to PDF", async () => {
    const pdf = await addWatermark(
      Buffer.from("%PDF-1.4 test"),
      "CTRL-TEST | Test User"
    );
    expect(pdf.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/__tests__/upload.integration.test.ts
git commit -m "test: add upload integration tests"
```

---

## Task 7.2: Permission Integration Test

**Files:**
- Create: `lib/__tests__/permissions.integration.test.ts`

**Step 1: Write test**

```typescript
// lib/__tests__/permissions.integration.test.ts
import { describe, it, expect } from "vitest";
import { canViewCase, canUploadToCase, canManageCase } from "../permissions";

describe("permissions integration", () => {
  it("admin can do everything", () => {
    expect(canViewCase({ role: "admin" }, null)).toBe(true);
    expect(canUploadToCase({ role: "admin" }, null)).toBe(true);
    expect(canManageCase({ role: "admin" })).toBe(true);
  });

  it("member without membership cannot view", () => {
    expect(canViewCase({ role: "member" }, null)).toBe(false);
  });

  it("viewer can view but not upload", () => {
    expect(canViewCase({ role: "member" }, { role: "viewer" })).toBe(true);
    expect(canUploadToCase({ role: "member" }, { role: "viewer" })).toBe(false);
  });

  it("uploader can view and upload", () => {
    expect(canViewCase({ role: "member" }, { role: "uploader" })).toBe(true);
    expect(canUploadToCase({ role: "member" }, { role: "uploader" })).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/__tests__/permissions.integration.test.ts
git commit -m "test: add permission integration tests"
```

---

## Task 7.3: Not Found Page

**Files:**
- Create: `app/not-found.tsx`

**Step 1: Write page**

```tsx
// app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Button asChild>
        <Link href="/cases">Back to Cases</Link>
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat: add not-found page"
```

---

## Task 7.4: Typecheck & Lint

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

## Task 7.5: Optional Seed Script

**Files:**
- Create: `prisma/seed.ts`

**Step 1: Write seed**

```typescript
// prisma/seed.ts
import { prisma } from "../lib/prisma";

async function main() {
  const admin = await prisma.user.create({
    data: {
      email: "admin@sbma.legal",
      name: "System Admin",
      role: "admin",
      isActive: true,
    },
  });
  console.log("Created admin user:", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed script to package.json**

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Step 3: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "chore: add optional Prisma seed script"
```
