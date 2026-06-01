import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AuditAction, DocumentStatus } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-guards";
import { decryptFile, decryptKey } from "@/lib/crypto";
import { MembershipRole, UserRole } from "@/lib/constants";
import { canDownloadDocument } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { addForensicWatermark } from "@/lib/watermark";

const DOWNLOAD_LIMIT = 30;
const DOWNLOAD_WINDOW_SECONDS = 60 * 60;
const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET = "+08:00";

/**
 * Extracts the first IP address from the x-forwarded-for header.
 * 
 * @param xForwardedFor The x-forwarded-for header value
 * @returns The client IP address, or undefined if not found
 */
function extractClientIp(xForwardedFor: string | null): string | undefined {
  if (!xForwardedFor) {
    return undefined;
  }

  const [firstAddress] = xForwardedFor.split(",");
  const ipAddress = firstAddress?.trim();

  return ipAddress ? ipAddress : undefined;
}

/**
 * Sanitizes a filename for use in a Content-Disposition header attachment.
 * 
 * @param filename The original filename
 * @returns A safe filename stripped of dangerous characters
 */
function sanitizeAttachmentFilename(filename: string): string {
  const sanitized = filename.replace(/["\\\r\n]/g, "_").trim();
  return sanitized || "document.pdf";
}

/**
 * Determines whether the user intends to download or print the document.
 * 
 * @param request The incoming request containing search parameters
 * @returns The intent of the copy action
 */
function getCopyIntent(request: Request): "download" | "print" {
  const intent = new URL(request.url).searchParams.get("intent");
  return intent === "print" ? "print" : "download";
}

/**
 * Sanitizes text to safely render on a PDF using standard PDF fonts, replacing unsupported characters.
 * 
 * @param value The text to sanitize
 * @param fallback The fallback string to use if the value is missing or empty
 * @returns The sanitized text safe for PDF rendering
 */
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

/**
 * Formats a Date object into a standardized timestamp string in Manila time.
 * 
 * @param date The date to format
 * @returns A string representation of the Manila timestamp
 */
function formatManilaTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${MANILA_OFFSET}`;
}

/**
 * Converts an S3 object body stream into a Buffer.
 * 
 * @param body The S3 response body
 * @returns A Buffer containing the object data
 */
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

/**
 * Increments the download rate limit counter for a given user and document.
 * 
 * @param rateLimitKey The unique key for the rate limit check
 * @returns An object indicating whether the request is allowed and when to retry if not
 */
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

/**
 * Handles GET requests to download or print a document. Validates permissions, 
 * enforces rate limits, fetches from S3, decrypts, and applies a forensic watermark.
 * 
 * @param request The incoming HTTP request
 * @param context The route context containing the document ID parameter
 * @returns A NextResponse containing the watermarked PDF or an error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const session = await requireAuth();
  const user = session.user;
  const intent = getCopyIntent(request);

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
    const generatedAt = formatManilaTimestamp(new Date());
    const watermarkedPdf = await addForensicWatermark(originalPdf, {
      controlNumber: toPdfTextSafe(doc.controlNumber, "unknown"),
      copyNumber: downloadCount,
      userName: toPdfTextSafe(user.name, "Unknown User"),
      userEmail: toPdfTextSafe(user.email, "unknown"),
      timestamp: generatedAt,
    });

    // Print requests are audited separately from downloads so the trail clearly
    // records when a user requested a printable copy instead of a standard file download.
    await logAudit({
      action: intent === "print" ? AuditAction.PRINT : AuditAction.DOWNLOAD,
      userId: user.id,
      documentId: doc.id,
      caseId: doc.caseId,
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: {
        controlNumber: doc.controlNumber,
        copyNumber: downloadCount,
        ...(intent === "print"
          ? { printedAt: generatedAt }
          : { downloadedAt: generatedAt }),
      },
    });

    return new NextResponse(new Uint8Array(watermarkedPdf), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${intent === "print" ? "inline" : "attachment"}; filename="${sanitizeAttachmentFilename(doc.originalFilename)}"`,
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
