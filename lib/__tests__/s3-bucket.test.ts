import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  S3_AUTO_CREATE_BUCKET: "true",
  S3_REGION: "ap-southeast-1",
}));
const s3SendMock = vi.hoisted(() => vi.fn());

vi.mock("@/env", () => ({
  env: envMock,
}));

vi.mock("@/lib/s3", () => ({
  BUCKET_NAME: "test-bucket",
  s3Client: {
    send: s3SendMock,
  },
}));

function s3Error(name: string, statusCode: number) {
  return Object.assign(new Error(name), {
    name,
    $metadata: { httpStatusCode: statusCode },
  });
}

describe("ensureStorageBucket", () => {
  afterEach(() => {
    envMock.S3_AUTO_CREATE_BUCKET = "true";
    envMock.S3_REGION = "ap-southeast-1";
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("does not call S3 when bucket auto-creation is disabled", async () => {
    envMock.S3_AUTO_CREATE_BUCKET = "false";

    const { ensureStorageBucket } = await import("@/lib/s3-bucket");
    await ensureStorageBucket();

    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("checks the configured bucket before upload work", async () => {
    s3SendMock.mockResolvedValueOnce({});

    const { ensureStorageBucket } = await import("@/lib/s3-bucket");
    await ensureStorageBucket();

    expect(s3SendMock).toHaveBeenCalledOnce();
    expect(s3SendMock.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect(s3SendMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        input: { Bucket: "test-bucket" },
      })
    );
  });

  it("creates the configured bucket when S3 reports it is missing", async () => {
    s3SendMock
      .mockRejectedValueOnce(s3Error("NoSuchBucket", 404))
      .mockResolvedValueOnce({});

    const { ensureStorageBucket } = await import("@/lib/s3-bucket");
    await ensureStorageBucket();

    expect(s3SendMock).toHaveBeenCalledTimes(2);
    expect(s3SendMock.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect(s3SendMock.mock.calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand);
    expect(s3SendMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          CreateBucketConfiguration: {
            LocationConstraint: "ap-southeast-1",
          },
        },
      })
    );
  });

  it("omits region configuration for us-east-1 bucket creation", async () => {
    envMock.S3_REGION = "us-east-1";
    s3SendMock
      .mockRejectedValueOnce(s3Error("NoSuchBucket", 404))
      .mockResolvedValueOnce({});

    const { ensureStorageBucket } = await import("@/lib/s3-bucket");
    await ensureStorageBucket();

    expect(s3SendMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        input: { Bucket: "test-bucket" },
      })
    );
  });

  it("rethrows non-missing bucket errors", async () => {
    const error = s3Error("Forbidden", 403);
    s3SendMock.mockRejectedValueOnce(error);

    const { ensureStorageBucket } = await import("@/lib/s3-bucket");
    await expect(ensureStorageBucket()).rejects.toBe(error);
  });
});
