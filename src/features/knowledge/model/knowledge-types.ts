import { z } from "zod";

export const KNOWLEDGE_TYPES = [
  "book",
  "course",
  "product",
  "event",
  "author",
  "person",
  "methodological",
  "faq",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const knowledgeTypeLabels: Record<KnowledgeType, string> = {
  book: "Livros",
  course: "Cursos e formações",
  product: "Produtos",
  event: "Eventos",
  author: "Autores",
  person: "Pessoas",
  methodological: "Conceitos e metodologia",
  faq: "Perguntas frequentes",
};

export const knowledgeTypeSlugs: Record<KnowledgeType, string> = {
  book: "livros",
  course: "cursos",
  product: "produtos",
  event: "eventos",
  author: "autores",
  person: "pessoas",
  methodological: "conceitos",
  faq: "faq",
};

export function getTypeFromSlug(slug: string): KnowledgeType | undefined {
  const entry = Object.entries(knowledgeTypeSlugs).find(([, val]) => val === slug);
  return entry ? (entry[0] as KnowledgeType) : undefined;
}

export const KnowledgeLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  type: z.enum([
    "purchase",
    "checkout",
    "landing_page",
    "video",
    "document",
    "social",
    "registration",
    "external_reference",
  ]),
});
export type KnowledgeLink = z.infer<typeof KnowledgeLinkSchema>;

export const BaseKnowledgeMetadataSchema = z.object({
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
  language: z.string().optional(),
  coverUrl: z.string().url().optional(),
  externalLinks: z.array(KnowledgeLinkSchema).optional(),
  internalNotes: z.string().optional(),
});
export type BaseKnowledgeMetadata = z.infer<typeof BaseKnowledgeMetadataSchema>;

export const BookMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  subtitle: z.string().optional(),
  isbn: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  publisher: z.string().optional(),
  publicationDate: z.string().optional(), // ISO YYYY-MM-DD
});
export type BookMetadata = z.infer<typeof BookMetadataSchema>;

export const CourseMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  workloadHours: z.number().positive().optional(),
  modality: z.enum(["online", "in_person", "hybrid"]).optional(),
  certification: z.boolean().optional(),
});
export type CourseMetadata = z.infer<typeof CourseMetadataSchema>;

export const ProductMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  status: z.enum(["active", "inactive", "coming_soon"]).optional(),
  checkoutUrl: z.string().url().optional(),
});
export type ProductMetadata = z.infer<typeof ProductMetadataSchema>;

export const EventMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  startDate: z.string().optional(), // ISO
  endDate: z.string().optional(), // ISO
  location: z.string().optional(),
  city: z.string().optional(),
  hotel: z.string().optional(),
});
export type EventMetadata = z.infer<typeof EventMetadataSchema>;

export const AuthorMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  nationality: z.string().optional(),
});
export type AuthorMetadata = z.infer<typeof AuthorMetadataSchema>;

export const ConceptMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  origin: z.string().optional(),
  scientificBase: z.string().optional(),
});
export type ConceptMetadata = z.infer<typeof ConceptMetadataSchema>;

export const FaqMetadataSchema = BaseKnowledgeMetadataSchema.extend({
  category: z.string().optional(),
});
export type FaqMetadata = z.infer<typeof FaqMetadataSchema>;

export type KnowledgeMetadataUnion =
  | BookMetadata
  | CourseMetadata
  | ProductMetadata
  | EventMetadata
  | AuthorMetadata
  | ConceptMetadata
  | FaqMetadata;

// A safe parser to cast raw JSON into one of the metadata types
// To be used depending on node.type
export function parseMetadata(type: string, raw: unknown): KnowledgeMetadataUnion {
  try {
    switch (type) {
      case "book":
        return BookMetadataSchema.parse(raw);
      case "course":
        return CourseMetadataSchema.parse(raw);
      case "product":
        return ProductMetadataSchema.parse(raw);
      case "event":
        return EventMetadataSchema.parse(raw);
      case "author":
      case "person":
        return AuthorMetadataSchema.parse(raw);
      case "methodological":
        return ConceptMetadataSchema.parse(raw);
      case "faq":
        return FaqMetadataSchema.parse(raw);
      default:
        return BaseKnowledgeMetadataSchema.parse(raw);
    }
  } catch (err) {
    // Return empty metadata if fails, so it doesn't crash the UI.
    // The UI should handle empty states and indicate missing/invalid data.
    console.error(`Error parsing metadata for type ${type}:`, err);
    return {};
  }
}
