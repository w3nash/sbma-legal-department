import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { AuditAction, DocumentStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-guards";
import { decryptFile, decryptKey, encryptFile } from "@/lib/crypto";
import { MembershipRole, UserRole } from "@/lib/constants";
import { canViewCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { addViewerWatermark } from "@/lib/watermark";

const VIEWER_CACHE_TTL_SECONDS = 60 * 60;

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  throw new Error("S3 object body is not readable");
}

function extractClientIp(xForwardedFor: string | null): string | undefined {
  if (!xForwardedFor) {
    return undefined;
  }

  const [firstAddress] = xForwardedFor.split(",");
  const ipAddress = firstAddress?.trim();

  return ipAddress ? ipAddress : undefined;
}

function sanitizeInlineFilename(filename: string): string {
  const sanitized = filename.replace(/["\\\r\n]/g, "_").trim();
  return sanitized || "document.pdf";
}

async function safeGetCachedViewer(
  viewerCacheKey: string
): Promise<string | null> {
  try {
    return await redis.get(viewerCacheKey);
  } catch (error) {
    console.error("Viewer cache read failed", {
      viewerCacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function safeSetCachedViewer(
  viewerCacheKey: string,
  encryptedViewer: Buffer
): Promise<void> {
  try {
    await redis.setex(
      viewerCacheKey,
      VIEWER_CACHE_TTL_SECONDS,
      encryptedViewer.toString("base64")
    );
  } catch (error) {
    console.error("Viewer cache write failed", {
      viewerCacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadEncryptedPdfFromS3(storedPdfKey: string): Promise<Buffer> {
  const viewerObject = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storedPdfKey,
    })
  );

  return bodyToBuffer(viewerObject.Body);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      caseId: true,
      controlNumber: true,
      status: true,
      originalFilename: true,
      storedOriginalKey: true,
      encryptionKey: true,
      case: {
        select: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { message: "Document not found" },
      { status: 404 }
    );
  }

  const membership =
    document.case.members.find((member) => member.userId === user.id) ?? null;
  const allowed = canViewCase(
    { role: user.role as UserRole },
    membership ? { role: membership.role as MembershipRole } : null
  );

  if (!allowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  if (
    document.status !== DocumentStatus.ready ||
    document.storedOriginalKey === null
  ) {
    return NextResponse.json(
      { message: "Document viewer is not ready" },
      { status: 409 }
    );
  }

  const viewerCacheKey = `viewer:v2:${document.controlNumber}`;
  const cachedViewer = await safeGetCachedViewer(viewerCacheKey);
  let source: "redis" | "s3" = cachedViewer ? "redis" : "s3";
  let pdfBuffer: Buffer;

  try {
    if (cachedViewer) {
      const fileKey = decryptKey(document.encryptionKey);
      pdfBuffer = decryptFile(Buffer.from(cachedViewer, "base64"), fileKey);
    } else {
      throw new Error("viewer cache miss");
    }
  } catch (error) {
    try {
      const encryptedOriginal = await loadEncryptedPdfFromS3(
        document.storedOriginalKey
      );
      const fileKey = decryptKey(document.encryptionKey);
      const originalPdf = decryptFile(encryptedOriginal, fileKey);
      pdfBuffer = await addViewerWatermark(originalPdf, document.controlNumber);
      await safeSetCachedViewer(
        viewerCacheKey,
        encryptFile(pdfBuffer, fileKey)
      );
      source = "s3";
    } catch (refreshError) {
      console.error("Viewer fetch failed", {
        documentId: document.id,
        error:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
        cachedError: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { message: "Viewer file is unavailable" },
        { status: 502 }
      );
    }
  }

  await logAudit({
    action: AuditAction.VIEW,
    userId: user.id,
    documentId: document.id,
    caseId: document.caseId,
    ipAddress: extractClientIp(request.headers.get("x-forwarded-for")),
    userAgent: request.headers.get("user-agent") ?? undefined,
    metadata: { source },
  });

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sanitizeInlineFilename(document.originalFilename)}"`,
    },
  });
}
