import fs from "fs";
import matter from "gray-matter";
import crypto from "crypto";
import { z } from "zod";

export const FrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum([
    "institutional",
    "methodological",
    "educational",
    "bibliographic",
    "commercial",
    "operational",
    "technical",
    "legal",
    "clinical_reference",
    "event",
    "product",
    "person",
    "author",
    "course",
    "book",
    "faq",
    "prompt",
    "page",
  ]),
  status: z.enum(["draft", "in_review", "approved", "archived"]).default("draft"),
  authority_level: z
    .enum(["official", "validated", "reference", "working_material", "unverified", "deprecated"])
    .default("unverified"),
  visibility: z.enum(["public", "internal", "restricted", "private"]).default("internal"),
  source_type: z.string().default("repository_file"),
  language: z.string().default("pt-BR"),
  author: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type ParsedNode = z.infer<typeof FrontmatterSchema> & {
  source_uri: string;
  content: string;
  content_hash: string;
  metadata: Record<string, unknown>;
};

export function parseFile(filePath: string): ParsedNode {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(rawContent);

  const content = parsed.content.trim();
  const data = FrontmatterSchema.parse(parsed.data);

  const hash = crypto.createHash("sha256").update(content).digest("hex");

  return {
    ...data,
    source_uri: filePath,
    content,
    content_hash: hash,
    metadata: parsed.data,
  };
}
