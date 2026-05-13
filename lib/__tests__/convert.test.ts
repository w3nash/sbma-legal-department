import { writeFileSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  execFile: execFileMock,
}));

describe("convert", () => {
  afterEach(() => {
    execFileMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("detects office MIME types that need PDF conversion", async () => {
    const { needsConversion } = await import("../convert");

    expect(
      needsConversion(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(needsConversion("application/vnd.ms-excel")).toBe(true);
    expect(needsConversion("application/vnd.ms-powerpoint")).toBe(true);
    expect(needsConversion("application/vnd.oasis.opendocument.text")).toBe(
      true
    );
    expect(needsConversion("application/rtf")).toBe(true);
    expect(needsConversion("text/rtf")).toBe(false);
    expect(needsConversion("application/pdf")).toBe(false);
  });

  it("returns the input file when conversion is not needed", async () => {
    const inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-test-"));
    const inputPath = path.join(inputDir, "document.pdf");
    await fs.writeFile(inputPath, "pdf contents");

    const { convertToPDF } = await import("../convert");
    const result = await convertToPDF(inputPath, "application/pdf");

    expect(result.toString()).toBe("pdf contents");
    expect(execFileMock).not.toHaveBeenCalled();

    await fs.rm(inputDir, { recursive: true, force: true });
  });

  it("converts office files with soffice and removes the temporary output directory", async () => {
    const inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-test-"));
    const inputPath = path.join(inputDir, "pleading.docx");
    await fs.writeFile(inputPath, "word contents");

    let outputDir = "";
    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        outputDir = args[args.indexOf("--outdir") + 1];
        writeFileSync(path.join(outputDir, "pleading.pdf"), "pdf output");
        callback(null, "", "");
      }
    );

    const { convertToPDF } = await import("../convert");
    const result = await convertToPDF(
      inputPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(result.toString()).toBe("pdf output");
    expect(execFileMock).toHaveBeenCalledWith(
      "soffice",
      ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
      { timeout: 60_000 },
      expect.any(Function)
    );
    await expect(fs.stat(outputDir)).rejects.toMatchObject({ code: "ENOENT" });

    await fs.rm(inputDir, { recursive: true, force: true });
  });

  it("uses SOFFICE_PATH when configured", async () => {
    vi.stubEnv("SOFFICE_PATH", "/custom/bin/soffice");
    const inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-test-"));
    const inputPath = path.join(inputDir, "pleading.docx");
    await fs.writeFile(inputPath, "word contents");

    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        const outputDir = args[args.indexOf("--outdir") + 1];
        writeFileSync(path.join(outputDir, "pleading.pdf"), "pdf output");
        callback(null, "", "");
      }
    );

    const { convertToPDF } = await import("../convert");
    await convertToPDF(
      inputPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(execFileMock).toHaveBeenCalledWith(
      "/custom/bin/soffice",
      expect.any(Array),
      { timeout: 60_000 },
      expect.any(Function)
    );

    await fs.rm(inputDir, { recursive: true, force: true });
  });

  it("falls back to soffice when SOFFICE_PATH is missing", async () => {
    vi.stubEnv(
      "SOFFICE_PATH",
      "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    );
    const inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbma-test-"));
    const inputPath = path.join(inputDir, "pleading.docx");
    await fs.writeFile(inputPath, "word contents");

    let outputDir = "";
    execFileMock.mockImplementation(
      (
        command: string,
        args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (
          command === "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        ) {
          const error = Object.assign(new Error("spawn ENOENT"), {
            code: "ENOENT",
          });
          callback(error, "", "");
          return;
        }

        outputDir = args[args.indexOf("--outdir") + 1];
        writeFileSync(path.join(outputDir, "pleading.pdf"), "pdf output");
        callback(null, "", "");
      }
    );

    const { convertToPDF } = await import("../convert");
    const result = await convertToPDF(
      inputPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(result.toString()).toBe("pdf output");
    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      expect.any(Array),
      { timeout: 60_000 },
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      "soffice",
      expect.any(Array),
      { timeout: 60_000 },
      expect.any(Function)
    );

    await fs.rm(inputDir, { recursive: true, force: true });
  });
});
