import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "@/env";
import { BUCKET_NAME, s3Client } from "@/lib/s3";

let ensureBucketPromise: Promise<void> | undefined;

function isMissingBucketError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode;

  return (
    statusCode === 404 ||
    error.name === "NoSuchBucket" ||
    error.name === "NotFound"
  );
}

async function ensureStorageBucketOnce(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return;
  } catch (error) {
    if (!isMissingBucketError(error)) {
      throw error;
    }
  }

  await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
}

export async function ensureStorageBucket(): Promise<void> {
  if (env.S3_AUTO_CREATE_BUCKET !== "true") return;

  ensureBucketPromise ??= ensureStorageBucketOnce().catch((error: unknown) => {
    ensureBucketPromise = undefined;
    throw error;
  });

  await ensureBucketPromise;
}
