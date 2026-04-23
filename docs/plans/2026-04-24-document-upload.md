# Document Upload Pipeline Implementation Plan

**Goal:** Upload any file format, auto-convert to PDF, encrypt, store in S3, cache viewer copy in Redis, write audit log.

---

## Task 5.1: File Conversion Helper

**Files:**
- Create: `lib/convert.ts`

**Step 1: Write implementation**

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

## Task 5.2: PDF Watermark Helper + Tests

**Files:**
- Create: `lib/watermark.ts`
- Create: `lib/__tests__/watermark.test.ts`

**Step 1: Install pdf-lib**

Run: `bun add pdf-lib`
Run: `bun add -D @types/pdf-lib`

**Step 2: Write failing test**

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

    const watermarked = await addWatermark(
      Buffer.from(original),
      "CTRL-123 | John | john@test.com | 192.168.1.1 | 2024-01-01"
    );
    expect(watermarked.length).toBeGreaterThan(0);
  });
});
```

**Step 3: Run (expect fail)**

Run: `bun test lib/__tests__/watermark.test.ts`
Expected: FAIL

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

**Step 5: Run (expect pass)**

Run: `bun test lib/__tests__/watermark.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/watermark.ts lib/__tests__/watermark.test.ts package.json
git commit -m "feat: add PDF watermark helper with tests"
```

---

## Task 5.3: Upload Server Action

**Files:**
- Create: `app/cases/[caseId]/upload/_actions.ts`

**Step 1: Install uuid**

Run: `bun add uuid`
Run: `bun add -D @types/uuid`

**Step 2: Write action**

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

    // Encrypt and store original
    const encryptedOriginal = encryptFile(pdfBuffer, fileKey);
    const originalKey = `documents/${caseId}/${controlNumber}/original.enc`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: originalKey,
        Body: encryptedOriginal,
      })
    );

    // Generate and store viewer copy
    const viewerWatermark = `Control Number: ${controlNumber}`;
    const viewerPdf = await addWatermark(pdfBuffer, viewerWatermark);
    const encryptedViewer = encryptFile(viewerPdf, fileKey);
    const viewerKey = `documents/${caseId}/${controlNumber}/viewer.enc`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: viewerKey,
        Body: encryptedViewer,
      })
    );

    // Cache in Redis
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

**Step 3: Commit**

```bash
git add app/cases/[caseId]/upload/_actions.ts package.json
git commit -m "feat: add document upload server action with encryption and watermarking"
```

---

## Task 5.4: Upload Form Page

**Files:**
- Create: `app/cases/[caseId]/upload/page.tsx`

**Step 1: Write page**

```tsx
// app/cases/[caseId]/upload/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { uploadDocument } from "./_actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        <div className="space-y-2">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          type="submit"
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/cases/[caseId]/upload/page.tsx
git commit -m "feat: add document upload page"
```
