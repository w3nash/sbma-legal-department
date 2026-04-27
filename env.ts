import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
    S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required"),
    S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
    S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
    S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
    S3_REGION: z.string().min(1, "S3_REGION is required"),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"], {
      message: "S3_FORCE_PATH_STYLE must be 'true' or 'false'",
    }),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    SOFFICE_PATH: z.string().min(1).optional(),
    MASTER_ENCRYPTION_KEY: z
      .string()
      .min(1, "MASTER_ENCRYPTION_KEY is required")
      .refine(
        (value) => Buffer.from(value, "base64").length === 32,
        "MASTER_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
      ),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.NODE_ENV === "test",
});
