import fs from "fs";
import path from "path";
import { env } from "@/env";

export const WATERMARK_BRAND_NAME = "SBMA LEGAL DEPARTMENT";
export const WATERMARK_BRAND_SHORT = "SBMA Legal Department";

export type WatermarkSealConfig = {
  enabled: boolean;
  path: string | null;
};

let cachedSealConfig: WatermarkSealConfig | undefined;

/**
 * Resolves whether an approved SBMA seal image should be embedded in watermarks.
 * Seal usage is gated on WATERMARK_SEAL_ENABLED and the asset file being present.
 * Result is cached after first resolution to avoid repeated sync filesystem checks.
 */
export function getWatermarkSealConfig(): WatermarkSealConfig {
  if (cachedSealConfig) {
    return cachedSealConfig;
  }

  const sealEnabled = env.WATERMARK_SEAL_ENABLED === "true";
  const sealPath =
    env.WATERMARK_SEAL_PATH ??
    path.join(process.cwd(), "public", "assets", "sbma-logo-blackwhite.png");

  if (!sealEnabled) {
    cachedSealConfig = { enabled: false, path: null };
    return cachedSealConfig;
  }

  if (!fs.existsSync(sealPath)) {
    cachedSealConfig = { enabled: false, path: null };
    return cachedSealConfig;
  }

  cachedSealConfig = { enabled: true, path: sealPath };
  return cachedSealConfig;
}
