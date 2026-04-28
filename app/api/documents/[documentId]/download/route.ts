import { GetObjectCommand } from "@aws-sdk/client-s3";
import { DocumentStatus } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-guards";
import { decryptFile, decryptKey } from "@/lib/crypto";
import { MembershipRole, UserRole } from "@/lib/constants";
import { canDownloadDocument } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { addWatermark } from "@/lib/watermark";

const DOWNLOAD_LIMIT = 30;
const DOWNLOAD_WINDOW_SECONDS = 60 * 60;

function extractClientIp(xForwardedFor: string | null): string | undefined {
  if (!xForwardedFor) {
    return undefined;
  }

  const [firstAddress] = xForwardedFor.split(",");
  const ipAddress = firstAddress?.trim();

  return ipAddress ? ipAddress : undefined;
}

function sanitizeAttachmentFilename(filename: string): string {
  const sanitized = filename.replace(/["\\\r\n]/g, "_").trim();
  return sanitized || "document.pdf";
}

function toPdfTextSafe(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value) {
    return fallback;
  }

  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || fallback;
}

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

async function incrementDownloadRateLimit(rateLimitKey: string) {
  const attempts = await redis.incr(rateLimitKey);

  if (attempts === 1) {
    await redis.expire(rateLimitKey, DOWNLOAD_WINDOW_SECONDS);
  }

  if (attempts <= DOWNLOAD_LIMIT) {
    return { allowed: true as const };
  }

  const retryAfter = await redis.ttl(rateLimitKey);

  return {
    allowed: false as const,
    retryAfter: retryAfter > 0 ? retryAfter : DOWNLOAD_WINDOW_SECONDS,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      caseId: true,
      controlNumber: true,
      originalFilename: true,
      status: true,
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

  if (!doc) {
    return NextResponse.json(
      { message: "Document not found" },
      { status: 404 }
    );
  }

  const membership =
    doc.case.members.find((member) => member.userId === user.id) ?? null;
  const canDownload = canDownloadDocument(
    { role: user.role as UserRole },
    membership ? { role: membership.role as MembershipRole } : null
  );

  if (!canDownload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  if (doc.status !== DocumentStatus.ready) {
    return NextResponse.json(
      { message: "Document is not ready for download" },
      { status: 409 }
    );
  }

  if (!doc.storedOriginalKey) {
    return NextResponse.json(
      { message: "Original document is unavailable" },
      { status: 409 }
    );
  }

  const rateLimit = await incrementDownloadRateLimit(
    `download:${user.id}:${documentId}`
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Download limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  try {
    const s3Object = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: doc.storedOriginalKey,
      })
    );
    const encryptedOriginal = await bodyToBuffer(s3Object.Body);
    const fileKey = decryptKey(doc.encryptionKey);
    const originalPdf = decryptFile(encryptedOriginal, fileKey);
    const { downloadCount } = await prisma.document.update({
      where: { id: doc.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
      select: {
        downloadCount: true,
      },
    });
    const ipAddress = extractClientIp(request.headers.get("x-forwarded-for"));
    const downloadedAt = new Date().toISOString();
    const watermark = [
      `Control Number: ${toPdfTextSafe(doc.controlNumber, "unknown")}`,
      `Copy Number: ${downloadCount}`,
      `User: ${toPdfTextSafe(user.name, "Unknown User")}`,
      `Email: ${toPdfTextSafe(user.email, "unknown")}`,
      `IP: ${toPdfTextSafe(ipAddress, "unknown")}`,
      `Timestamp: ${downloadedAt}`,
    ];
    const watermarkedPdf = await addWatermark(originalPdf, watermark);

    await logAudit({
      action: "DOWNLOAD",
      userId: user.id,
      documentId: doc.id,
      caseId: doc.caseId,
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: {
        controlNumber: doc.controlNumber,
        copyNumber: downloadCount,
        downloadedAt,
      },
    });

    return new NextResponse(new Uint8Array(watermarkedPdf), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${sanitizeAttachmentFilename(doc.originalFilename)}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    console.error("Document download failed", {
      documentId: doc.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { message: "Document storage unavailable" },
      { status: 502 }
    );
  }
}
