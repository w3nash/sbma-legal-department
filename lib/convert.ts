import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

export async function convertToPDF(
  inputPath: string,
  mimeType: string,
): Promise<Buffer> {
  if (!needsConversion(mimeType)) {
    return fs.readFile(inputPath);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-"));
  try {
    await execFileAsync("soffice", [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      inputPath,
    ]);

    const basename = path.basename(inputPath, path.extname(inputPath));
    return fs.readFile(path.join(tmpDir, `${basename}.pdf`));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
