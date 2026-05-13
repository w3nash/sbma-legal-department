import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { env } from "@/env";

const execFileAsync = promisify(execFile);
const SOFFICE_TIMEOUT_MS = 60_000;

const OFFICE_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
];

export function needsConversion(mimeType: string): boolean {
  return OFFICE_MIMES.includes(mimeType);
}

function getSofficePath(): string {
  return env.SOFFICE_PATH ?? "soffice";
}

async function runSoffice(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, {
    timeout: SOFFICE_TIMEOUT_MS,
  });
}

export async function convertToPDF(
  inputPath: string,
  mimeType: string
): Promise<Buffer> {
  if (!needsConversion(mimeType)) {
    return fs.readFile(inputPath);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-"));
  try {
    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      inputPath,
    ];
    const configuredPath = getSofficePath();

    try {
      await runSoffice(configuredPath, args);
    } catch (error) {
      const errorCode =
        error instanceof Error
          ? (error as NodeJS.ErrnoException).code
          : undefined;

      if (configuredPath !== "soffice" && errorCode === "ENOENT") {
        await runSoffice("soffice", args);
      } else {
        throw error;
      }
    }

    const basename = path.basename(inputPath, path.extname(inputPath));
    return fs.readFile(path.join(tmpDir, `${basename}.pdf`));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
