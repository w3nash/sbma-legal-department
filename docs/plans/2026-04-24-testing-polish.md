# Testing & Polish Implementation Plan

**Goal:** Integration tests, typecheck, lint, not-found page, optional seed script.

---

## Task 7.1: Upload Integration Test

**Files:**
- Create: `lib/__tests__/upload.integration.test.ts`

```typescript
// lib/__tests__/upload.integration.test.ts
import { describe, it, expect } from "vitest";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { encryptFile, decryptFile, encryptKey, decryptKey, generateFileKey } from "@/lib/crypto";
import { addWatermark } from "@/lib/watermark";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

describe("upload integration", () => {
  it("encrypts, stores, retrieves, and decrypts a document", async () => {
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

**Run tests**

Run: `bun run test`
Expected: PASS

**Commit**

```bash
git add lib/__tests__/upload.integration.test.ts
git commit -m "test: add upload integration tests"
```

---

## Task 7.2: Permission Integration Test

**Files:**
- Create: `lib/__tests__/permissions.integration.test.ts`

```typescript
// lib/__tests__/permissions.integration.test.ts
import { describe, it, expect } from "vitest";
import { canViewCase, canUploadToCase, canManageCase } from "@/lib/permissions";
import { UserRole, MembershipRole } from "@/lib/constants";

describe("permissions", () => {
  it("admin can do everything", () => {
    expect(canViewCase({ role: UserRole.Admin }, null)).toBe(true);
    expect(canUploadToCase({ role: UserRole.Admin }, null)).toBe(true);
    expect(canManageCase({ role: UserRole.Admin })).toBe(true);
  });

  it("member without membership cannot view", () => {
    expect(canViewCase({ role: UserRole.Member }, null)).toBe(false);
  });

  it("viewer can view but not upload", () => {
    expect(canViewCase({ role: UserRole.Member }, { role: MembershipRole.Viewer })).toBe(true);
    expect(canUploadToCase({ role: UserRole.Member }, { role: MembershipRole.Viewer })).toBe(false);
  });

  it("uploader can view and upload", () => {
    expect(canViewCase({ role: UserRole.Member }, { role: MembershipRole.Uploader })).toBe(true);
    expect(canUploadToCase({ role: UserRole.Member }, { role: MembershipRole.Uploader })).toBe(true);
  });
});
```

**Run tests**

Run: `bun run test`
Expected: PASS

**Commit**

```bash
git add lib/__tests__/permissions.integration.test.ts
git commit -m "test: add permission integration tests"
```

---

## Task 7.3: Not Found Page

**Files:**
- Create: `app/not-found.tsx`

```tsx
// app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Route } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Button asChild>
        <Link href={Route.Cases}>Back to Cases</Link>
      </Button>
    </div>
  );
}
```

**Commit**

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

## Task 7.5: Seed Script

**Files:**
- Modify: `prisma/seed.ts`

> Use `auth.api.createUser()` so the password is properly hashed through better-auth's pipeline rather than inserting a raw record via Prisma.

```typescript
// prisma/seed.ts
import { auth } from "../lib/auth";
import { UserRole } from "../lib/constants";

async function main() {
  const admin = await auth.api.createUser({
    body: {
      email: "admin@sbma.legal",
      name: "System Admin",
      password: process.env.SEED_ADMIN_PASSWORD ?? "changeme123",
      role: UserRole.Admin,
    },
  });
  console.log("Created admin user:", admin.user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

**Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: update seed script to use auth.api.createUser"
```
