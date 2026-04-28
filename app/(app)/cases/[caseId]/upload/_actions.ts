"use server";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { AuditAction, DocumentStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-guards";
import { MembershipRole, UserRole } from "@/lib/constants";
import { encryptFile, encryptKey, generateFileKey } from "@/lib/crypto";
import {
  MAX_UPLOAD_SIZE_BYTES,
  getSupportedMimeType,
} from "@/lib/document-upload";
import { enqueueDocumentProcessingJob } from "@/lib/document-processing";
import { canUploadToCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { ensureStorageBucket } from "@/lib/s3-bucket";

async function cleanupStoredUpload(uploadedKeys: string[]) {
  await Promise.allSettled(
    uploadedKeys.map((key) =>
      s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    )
  );
}

function getUploadFiles(formData: FormData): File[] {
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length > 0) return files;

  const file = formData.get("file");
  return file instanceof File ? [file] : [];
}

export async function uploadDocuments(caseId: string, formData: FormData) {
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

  const files = getUploadFiles(formData);
  if (files.length === 0) {
    throw new Error("No files provided");
  }

  const validatedFiles = files.map((file) => {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error("File exceeds 50MB upload limit");
    }

    return {
      file,
      sourceMimeType: getSupportedMimeType(file),
    };
  });

  await ensureStorageBucket();

  const ipAddress = (await headers()).get("x-forwarded-for") ?? undefined;
  const uploadedKeys: string[] = [];
  const createdDocumentIds: string[] = [];

  try {
    for (const { file, sourceMimeType } of validatedFiles) {
      const controlNumber = uuidv4();
      const fileKey = generateFileKey();
      const encryptionKey = encryptKey(fileKey);
      const sourceKey = `documents/${caseId}/${controlNumber}/source.enc`;
      const encryptedSource = encryptFile(
        Buffer.from(await file.arrayBuffer()),
        fileKey
      );

      uploadedKeys.push(sourceKey);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: sourceKey,
          Body: encryptedSource,
        })
      );

      const doc = await prisma.document.create({
        data: {
          caseId,
          controlNumber,
          status: DocumentStatus.processing,
          originalFilename: file.name,
          storedSourceKey: sourceKey,
          storedOriginalKey: null,
          storedViewerKey: null,
          fileSizeBytes: BigInt(file.size),
          mimeType: sourceMimeType,
          encryptionKey,
          uploadedById: user.id,
        },
      });

      createdDocumentIds.push(doc.id);
      await enqueueDocumentProcessingJob(doc.id);

      await logAudit({
        action: AuditAction.UPLOAD,
        userId: user.id,
        documentId: doc.id,
        caseId,
        ipAddress,
        metadata: { phase: "queued" },
      });
    }

    return {
      success: true,
      documentIds: createdDocumentIds,
      createdCount: createdDocumentIds.length,
    };
  } catch (error) {
    if (createdDocumentIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }

    await cleanupStoredUpload(uploadedKeys);
    throw error;
  }
}

export async function uploadDocument(caseId: string, formData: FormData) {
  return uploadDocuments(caseId, formData);
}
