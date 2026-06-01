import fs from "fs";
import path from "path";
import { env } from "@/env";

export const WATERMARK_BRAND_NAME = "SBMA LEGAL DEPARTMENT";
export const WATERMARK_BRAND_SHORT = "SBMA Legal Department";

export type WatermarkSealConfig = {
  enabled: boolean;
  path: string | null;
};

/**
 * Resolves whether an approved SBMA seal image should be embedded in watermarks.
 * Seal usage is gated on WATERMARK_SEAL_ENABLED and the asset file being present.
 */
export function getWatermarkSealConfig(): WatermarkSealConfig {
  const sealEnabled = env.WATERMARK_SEAL_ENABLED === "true";
  const sealPath =
    env.WATERMARK_SEAL_PATH ??
    path.join(process.cwd(), "public", "assets", "sbma-logo-blackwhite.png");

  if (!sealEnabled) {
    return { enabled: false, path: null };
  }

  if (!fs.existsSync(sealPath)) {
    return { enabled: false, path: null };
  } 

  return { enabled: true, path: sealPath };
}
