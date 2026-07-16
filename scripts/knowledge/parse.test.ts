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
slug: test-slug
type: book
status: draft
authority_level: unverified
visibility: internal
source_type: repository_file
language: pt-BR
relations:
  - type: belongs_to
    target: liz-psicogenealogia
assets:
  - id: asset-1
    type: image
    category: cover
    name: Capa
    provider: supabase
    bucket: knowledge-assets
    path: books/test-id/cover.png
    is_primary: true
---
Hello World
`,
    );

    const result = parseFile(mockFile);
    expect(result.id).toBe("test-id");
    expect(result.title).toBe("Test Title");
    expect(result.content).toBe("Hello World");
    expect(result.relations).toHaveLength(1);
    expect(result.assets).toHaveLength(1);
    expect(result.assets?.[0].category).toBe("cover");

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

  it("should reject provider Supabase without bucket/path", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "image",
          category: "cover",
          name: "Capa",
          provider: "supabase",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/Invalid storage configuration/);
  });

  it("should reject provider externo without URL", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "link",
          category: "checkout",
          name: "Buy",
          provider: "hotmart",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/Invalid storage configuration/);
  });

  it("should reject provider Supabase with external URL", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "image",
          category: "cover",
          name: "Capa",
          provider: "supabase",
          bucket: "a",
          path: "b",
          external_url: "http",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/Invalid storage configuration/);
  });

  it("should reject incompatible category for node type", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "link",
          category: "registration_page",
          name: "Register",
          provider: "external_url",
          external_url: "http",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(
      /Category 'registration_page' is not valid for node type 'book'/,
    );
  });

  it("should reject more than one primary asset per category", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "1",
          type: "image",
          category: "cover",
          name: "Capa 1",
          provider: "external_url",
          external_url: "http",
          is_primary: true,
        },
        {
          id: "2",
          type: "image",
          category: "cover",
          name: "Capa 2",
          provider: "external_url",
          external_url: "http",
          is_primary: true,
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/Multiple primary assets found/);
  });

  it("should reject path traversal in repository provider", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "image",
          category: "cover",
          name: "Capa",
          provider: "repository",
          path: "../../../secret.txt",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/path traversal/);
  });

  it("should reject public visibility if rights unknown", () => {
    const input = {
      id: "a",
      title: "a",
      slug: "a",
      type: "book",
      assets: [
        {
          id: "asset-1",
          type: "image",
          category: "cover",
          name: "Capa",
          provider: "external_url",
          external_url: "http",
          visibility: "public",
          rights_status: "unknown",
        },
      ],
    };
    expect(() => FrontmatterSchema.parse(input)).toThrowError(/Invalid combination/);
  });
});
