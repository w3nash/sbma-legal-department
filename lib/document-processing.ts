import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type Redis from "ioredis";
import { DocumentStatus } from "@/generated/prisma/client";
import { convertToPDF } from "@/lib/convert";
import { decryptFile, decryptKey, encryptFile } from "@/lib/crypto";
import {
  assertPdfSize,
  getProcessedPdfFilename,
  safeBasename,
} from "@/lib/document-upload";
import { validatePdfReadability } from "@/lib/readability";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BUCKET_NAME, s3Client } from "@/lib/s3";
import { addViewerWatermark } from "@/lib/watermark";

const QUEUE_KEY = "document-processing:queue";
const PROCESSING_KEY = "document-processing:processing";

type DocumentProcessingJob = {
  documentId: string;
};

function serializeDocumentProcessingJob(job: DocumentProcessingJob): string {
  return JSON.stringify(job);
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

async function cleanupArtifacts(keys: string[], viewerCacheKey?: string) {
  const cleanupTasks: Promise<unknown>[] = keys.map((key) =>
    s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
  );

  if (viewerCacheKey) {
    cleanupTasks.push(redis.del(viewerCacheKey));
  }

  await Promise.allSettled(cleanupTasks);
}

async function markDocumentFailed(documentId: string, error: unknown) {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: DocumentStatus.failed,
      processingError:
        error instanceof Error ? error.message : "Document processing failed",
    },
  });
}

export async function enqueueDocumentProcessingJob(documentId: string) {
  const job: DocumentProcessingJob = { documentId };
  await redis.lpush(QUEUE_KEY, serializeDocumentProcessingJob(job));
}

export async function removeDocumentProcessingJob(documentId: string) {
  const payload = serializeDocumentProcessingJob({ documentId });
  await Promise.allSettled([
    redis.lrem(QUEUE_KEY, 0, payload),
    redis.lrem(PROCESSING_KEY, 0, payload),
  ]);
}

export async function processDocument(documentId: string) {
  const uploadedKeys: string[] = [];
  let viewerCacheKey: string | undefined;
  console.log("Starting document processing", { documentId });

  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        caseId: true,
        controlNumber: true,
        originalFilename: true,
        storedSourceKey: true,
        mimeType: true,
        encryptionKey: true,
        status: true,
      },
    });

    if (
      !doc ||
      doc.status !== DocumentStatus.processing ||
      !doc.storedSourceKey
    ) {
      console.log("Skipping document processing", {
        documentId,
        reason: !doc
          ? "missing"
          : doc.status !== DocumentStatus.processing
            ? "status-not-processing"
            : "missing-source-key",
      });
      return;
    }

    const sourceObject = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: doc.storedSourceKey })
    );
    const encryptedSource = await bodyToBuffer(sourceObject.Body);
    const fileKey = decryptKey(doc.encryptionKey);
    const sourceBuffer = decryptFile(encryptedSource, fileKey);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-process-"));

    try {
      const sourcePath = path.join(tmpDir, safeBasename(doc.originalFilename));
      await fs.writeFile(sourcePath, sourceBuffer);

      const pdfBuffer = await convertToPDF(
        sourcePath,
        doc.mimeType ?? "application/octet-stream"
      );
      assertPdfSize(pdfBuffer, "Converted");

      // Validate readability after conversion
      const conversionReport = await validatePdfReadability(pdfBuffer, {
        label: "Post-conversion",
      });
      if (!conversionReport.valid) {
        throw new Error(
          `Converted PDF failed readability check: ${conversionReport.errors.join("; ")}`
        );
      }

      const originalKey = `documents/${doc.caseId}/${doc.controlNumber}/original.enc`;
      const encryptedOriginal = encryptFile(pdfBuffer, fileKey);
      uploadedKeys.push(originalKey);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: originalKey,
          Body: encryptedOriginal,
        })
      );

      const viewerPdf = await addViewerWatermark(pdfBuffer, doc.controlNumber);
      assertPdfSize(viewerPdf, "Viewer");

      // Validate readability after watermarking
      const viewerReport = await validatePdfReadability(viewerPdf, {
        label: "Post-watermark",
      });
      if (!viewerReport.valid) {
        throw new Error(
          `Viewer PDF failed readability check: ${viewerReport.errors.join("; ")}`
        );
      }

      const viewerKey = `documents/${doc.caseId}/${doc.controlNumber}/viewer.enc`;
      const encryptedViewer = encryptFile(viewerPdf, fileKey);
      uploadedKeys.push(viewerKey);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: viewerKey,
          Body: encryptedViewer,
        })
      );

      viewerCacheKey = `viewer:${doc.controlNumber}`;
      await redis.setex(
        viewerCacheKey,
        3600,
        encryptedViewer.toString("base64")
      );

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: DocumentStatus.ready,
          originalFilename: getProcessedPdfFilename(doc.originalFilename),
          storedSourceKey: null,
          storedOriginalKey: originalKey,
          storedViewerKey: viewerKey,
          mimeType: "application/pdf",
          processingError: null,
        },
      });

      const finalFilename = getProcessedPdfFilename(doc.originalFilename);

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: doc.storedSourceKey,
        })
      );

      console.log("Document processing completed", {
        documentId: doc.id,
        caseId: doc.caseId,
        filename: finalFilename,
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  } catch (error) {
    await cleanupArtifacts(uploadedKeys, viewerCacheKey);
    await markDocumentFailed(documentId, error);
    console.error("Document processing failed", {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function processQueuedDocumentJob(payload: string) {
  const job = JSON.parse(payload) as DocumentProcessingJob;
  await processDocument(job.documentId);
}

export async function runDocumentProcessingWorker(client: Redis = redis) {
  console.log("Document processing worker started");

  while (true) {
    console.log("Document processing worker waiting for jobs");
    const payload = await client.brpoplpush(QUEUE_KEY, PROCESSING_KEY, 5);

    if (!payload) continue;

    console.log("Document processing worker dequeued job", { payload });

    try {
      await processQueuedDocumentJob(payload);
    } finally {
      await client.lrem(PROCESSING_KEY, 1, payload);
      console.log("Document processing worker acknowledged job", { payload });
    }
  }
}
