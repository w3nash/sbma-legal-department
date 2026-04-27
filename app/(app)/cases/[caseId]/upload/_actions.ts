"use server";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import { headers } from "next/headers";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { AuditAction } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-guards";
import { MembershipRole, UserRole } from "@/lib/constants";
import { convertToPDF } from "@/lib/convert";
import { encryptFile, encryptKey, generateFileKey } from "@/lib/crypto";
import { canUploadToCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { ensureStorageBucket } from "@/lib/s3-bucket";
import { addWatermark } from "@/lib/watermark";

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".rtf": "application/rtf",
};
const SUPPORTED_INPUT_MIMES = new Set(Object.values(MIME_BY_EXTENSION));
const UNTRUSTED_UPLOAD_MIMES = new Set(["", "application/octet-stream"]);

function safeBasename(filename: string): string {
  const basename = path.basename(filename.replaceAll("\\", "/"));
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (sanitized === "." || sanitized === "..") return "upload";
  return sanitized || "upload";
}

function assertPdfSize(buffer: Buffer, label: "Converted" | "Viewer") {
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`${label} PDF exceeds 50MB upload limit`);
  }
}

function getSupportedMimeType(file: File): string {
  const normalizedMimeType = file.type.trim().toLowerCase();
  const extensionMimeType =
    MIME_BY_EXTENSION[path.extname(file.name).toLowerCase()];

  if (UNTRUSTED_UPLOAD_MIMES.has(normalizedMimeType) && extensionMimeType) {
    return extensionMimeType;
  }

  if (SUPPORTED_INPUT_MIMES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  throw new Error("Unsupported file type");
}

async function cleanupStoredUpload(
  uploadedKeys: string[],
  viewerCacheKey: string | undefined
) {
  const cleanupTasks: Promise<unknown>[] = uploadedKeys.map((key) =>
    s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
  );

  if (viewerCacheKey) {
    cleanupTasks.push(redis.del(viewerCacheKey));
  }

  await Promise.allSettled(cleanupTasks);
}

export async function uploadDocument(caseId: string, formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const membership = await prisma.caseMember.findUnique({
    where: { caseId_userId: { caseId, userId: user.id } },
  });

  const canUpload = canUploadToCase(
    { role: user.role as UserRole },
    membership ? { role: membership.role as MembershipRole } : null
  );
  if (!canUpload) {
    throw new Error("Unauthorized");
  }

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!c) {
    throw new Error("Case not found");
  }

  const file = formData.get("file") as File | null;
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("No file provided");
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("File exceeds 50MB upload limit");
  }
  const sourceMimeType = getSupportedMimeType(file);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-upload-"));
  const uploadedKeys: string[] = [];
  let viewerCacheKey: string | undefined;
  try {
    const tmpPath = path.join(tmpDir, safeBasename(file.name));
    await fs.writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

    const pdfBuffer = await convertToPDF(tmpPath, sourceMimeType);
    assertPdfSize(pdfBuffer, "Converted");
    const controlNumber = uuidv4();
    const fileKey = generateFileKey();
    const encryptionKey = encryptKey(fileKey);

    const originalKey = `documents/${caseId}/${controlNumber}/original.enc`;
    const encryptedOriginal = encryptFile(pdfBuffer, fileKey);
    await ensureStorageBucket();
    uploadedKeys.push(originalKey);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: originalKey,
        Body: encryptedOriginal,
      })
    );

    const viewerPdf = await addWatermark(
      pdfBuffer,
      `Control Number: ${controlNumber}`
    );
    assertPdfSize(viewerPdf, "Viewer");
    const viewerKey = `documents/${caseId}/${controlNumber}/viewer.enc`;
    const encryptedViewer = encryptFile(viewerPdf, fileKey);
    uploadedKeys.push(viewerKey);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: viewerKey,
        Body: encryptedViewer,
      })
    );

    viewerCacheKey = `viewer:${controlNumber}`;
    await redis.setex(viewerCacheKey, 3600, encryptedViewer.toString("base64"));

    const ipAddress = (await headers()).get("x-forwarded-for") ?? undefined;
    const doc = await prisma.document.create({
      data: {
        caseId,
        controlNumber,
        originalFilename: file.name,
        storedOriginalKey: originalKey,
        storedViewerKey: viewerKey,
        fileSizeBytes: BigInt(file.size),
        mimeType: "application/pdf",
        encryptionKey,
        uploadedById: user.id,
      },
    });

    await logAudit({
      action: AuditAction.UPLOAD,
      userId: user.id,
      documentId: doc.id,
      caseId,
      ipAddress,
    });

    return { success: true, documentId: doc.id };
  } catch (error) {
    await cleanupStoredUpload(uploadedKeys, viewerCacheKey);
    throw error;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
