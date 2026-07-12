import { describe, it, expect } from "vitest";
import { scanDirectory } from "./scan";
import fs from "fs";
import path from "path";
import os from "os";

describe("scanDirectory secret scanner", () => {
  it("should block files containing secrets in content", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test-"));
    const secretFile = path.join(tmpDir, "secret-test.md");

    // Write a mock secret that matches the regex
    fs.writeFileSync(secretFile, "Here is my secret GOCSPX-1234567890");

    const errors: {file: string, error: string}[] = [];
    const files = scanDirectory(tmpDir, [], errors);

    expect(files.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0].error).toContain("content pattern detected");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should block files with secret filenames", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test2-"));
    const envFile = path.join(tmpDir, ".env.local");
    const pemFile = path.join(tmpDir, "key.pem");
    const validFile = path.join(tmpDir, "valid.md");

    fs.writeFileSync(envFile, "SECRET=123");
    fs.writeFileSync(pemFile, "KEY");
    fs.writeFileSync(validFile, "Hello");

    const errors: {file: string, error: string}[] = [];
    const files = scanDirectory(tmpDir, [], errors);

    expect(files.length).toBe(1);
    expect(files[0]).toBe(validFile);
    expect(errors.length).toBe(2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
