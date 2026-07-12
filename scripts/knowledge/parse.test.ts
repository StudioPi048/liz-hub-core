import { describe, it, expect } from "vitest";
import { parseFile, FrontmatterSchema } from "./parse";
import fs from "fs";
import path from "path";
import os from "os";

describe("parseFile and Zod Schema", () => {
  it("should parse valid frontmatter", () => {
    const tmpDir = os.tmpdir();
    const mockFile = path.join(tmpDir, "test-valid.md");
    fs.writeFileSync(
      mockFile,
      `---
id: test-id
title: Test Title
type: institutional
status: draft
authority_level: unverified
visibility: internal
source_type: repository_file
language: pt-BR
relations:
  - type: belongs_to
    target: liz-psicogenealogia
---
Hello World
`,
    );

    const result = parseFile(mockFile);
    expect(result.id).toBe("test-id");
    expect(result.title).toBe("Test Title");
    expect(result.content).toBe("Hello World");
    expect(result.relations).toHaveLength(1);
    expect(result.relations?.[0].type).toBe("belongs_to");
    expect(result.content_hash).toBeDefined();

    fs.unlinkSync(mockFile);
  });

  it("should reject invalid frontmatter (missing id)", () => {
    const tmpDir = os.tmpdir();
    const mockFile = path.join(tmpDir, "test-invalid.md");
    fs.writeFileSync(
      mockFile,
      `---
title: Test Title
type: institutional
---
Hello World
`,
    );

    expect(() => parseFile(mockFile)).toThrowError();
    fs.unlinkSync(mockFile);
  });
});
