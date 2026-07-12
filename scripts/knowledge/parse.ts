import fs from "fs";
import matter from "gray-matter";
import crypto from "crypto";
import { z } from "zod";
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  STORAGE_PROVIDERS,
  RIGHTS_STATUSES,
  VISIBILITIES,
  ASSET_STATUSES,
  isValidCategoryForNode
} from "../../src/features/knowledge/model/asset-vocabulary";

export const RelationSchema = z.object({
  type: z.enum([
    "belongs_to",
    "part_of",
    "authored_by",
    "created_by",
    "mentions",
    "references",
    "explains",
    "applies_to",
    "related_to",
    "prerequisite_of",
    "offered_by",
    "used_in",
    "contradicts",
    "supersedes",
    "version_of",
  ]),
  target: z.string().min(1),
});

export const AssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ASSET_TYPES),
  category: z.enum(ASSET_CATEGORIES),
  name: z.string().min(1),
  description: z.string().optional(),
  alt_text: z.string().optional(),
  provider: z.enum(STORAGE_PROVIDERS),
  bucket: z.string().optional(),
  path: z.string().optional(),
  external_url: z.string().optional(),
  status: z.enum(ASSET_STATUSES).default("draft"),
  visibility: z.enum(VISIBILITIES).default("internal"),
  rights_status: z.enum(RIGHTS_STATUSES).default("unknown"),
  is_primary: z.boolean().default(false),
}).refine(data => {
  if (data.provider === 'supabase') {
    return !!data.bucket && !!data.path && !data.external_url;
  }
  if (data.provider === 'repository') {
    // using path to store source_reference, no bucket, no external_url
    return !!data.path && !data.external_url && !data.bucket;
  }
  return !!data.external_url && !data.bucket && !data.path;
}, {
  message: "Invalid storage configuration for provider (e.g. supabase needs bucket/path and no url, external needs url and no bucket/path, repository needs path and no external url/bucket)."
}).refine(data => {
  if (data.rights_status === 'unknown' && data.visibility === 'public') {
    return false;
  }
  if (data.rights_status === 'restricted' && data.visibility !== 'restricted' && data.visibility !== 'private') {
    return false;
  }
  return true;
}, { message: "Invalid combination of rights_status and visibility." }).refine(data => {
  if (data.provider === 'repository' && (data.path?.includes('../') || data.path?.startsWith('/'))) {
    return false;
  }
  return true;
}, { message: "Repository provider path cannot be absolute or contain path traversal (../)" });

export const FrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
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
    "concept"
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
  relations: z.array(RelationSchema).optional(),
  assets: z.array(AssetSchema).optional(),
}).superRefine((val, ctx) => {
  if (val.assets && val.assets.length > 0) {
    const primaryCounts = new Map<string, number>();
    for (const asset of val.assets) {
      if (!isValidCategoryForNode(val.type, asset.category)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Category '${asset.category}' is not valid for node type '${val.type}'`,
          path: ["assets"]
        });
      }
      if (asset.is_primary) {
        const key = asset.category;
        primaryCounts.set(key, (primaryCounts.get(key) || 0) + 1);
      }
    }
    for (const [cat, count] of primaryCounts.entries()) {
      if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Multiple primary assets found for category '${cat}'. Only one is allowed.`,
          path: ["assets"]
        });
      }
    }
  }
});

export type RelationNode = z.infer<typeof RelationSchema>;
export type AssetNode = z.infer<typeof AssetSchema>;

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
