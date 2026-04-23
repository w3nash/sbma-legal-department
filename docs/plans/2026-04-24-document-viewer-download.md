# Document Viewer & Download Implementation Plan

**Goal:** Viewer API route (cached viewer copy), download API route (unique watermark + rate limit), document viewer page with iframe.

---

## Task 6.1: Viewer API Route

**Files:**
- Create: `app/api/documents/[documentId]/viewer/route.ts`

**Step 1: Write route**

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

  const cacheKey = `viewer:${doc.controlNumber}`;
  const cached = await redis.get(cacheKey);
  let pdfBuffer: Buffer;

  if (cached) {
    pdfBuffer = Buffer.from(cached, "base64");
  } else {
    const s3Res = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: doc.storedViewerKey,
      })
    );
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

## Task 6.2: Download API Route

**Files:**
- Create: `app/api/documents/[documentId]/download/route.ts`

**Step 1: Write route**

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

  const s3Res = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: doc.storedOriginalKey,
    })
  );
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

## Task 6.3: Document Viewer Page

**Files:**
- Create: `app/cases/[caseId]/documents/[documentId]/page.tsx`

**Step 1: Write page**

```tsx
// app/cases/[caseId]/documents/[documentId]/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { canViewCase } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
      <Card>
        <CardHeader>
          <CardTitle>{doc.originalFilename}</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">
            Control #: {doc.controlNumber}
          </p>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button asChild>
            <a href={downloadUrl}>Download</a>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="h-[80vh] w-full rounded border">
        <iframe
          src={viewerUrl}
          className="h-full w-full"
          title={doc.originalFilename}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/cases/[caseId]/documents
git commit -m "feat: add document viewer page with iframe and download button"
```
