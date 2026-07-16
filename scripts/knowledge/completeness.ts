import { ParsedNode } from "./parse";

export type CompletenessScore = "complete" | "partial" | "minimal" | "invalid";

interface TypeRequirements {
  essential: string[];
  recommended: string[];
}

const REQUIREMENTS_BY_TYPE: Record<string, TypeRequirements> = {
  book: {
    essential: ["title", "author", "summary", "source_type"],
    recommended: [
      "asset:cover",
      "asset:checkout",
      "asset:interior_pdf",
      "metadata:isbn",
      "metadata:publisher",
    ],
  },
  course: {
    essential: ["title", "summary", "source_type"],
    recommended: [
      "asset:landing_page",
      "asset:checkout",
      "asset:slide_deck",
      "metadata:professors",
      "metadata:program",
    ],
  },
  author: {
    essential: ["title", "summary", "source_type"],
    recommended: ["asset:cover", "metadata:bio", "metadata:social"],
  },
  event: {
    essential: ["title", "summary", "source_type"],
    recommended: [
      "asset:registration_page",
      "asset:schedule",
      "asset:gallery",
      "metadata:location",
      "metadata:organizer",
    ],
  },
  product: {
    essential: ["title", "summary", "source_type"],
    recommended: ["asset:cover", "asset:checkout", "asset:landing_page", "metadata:price"],
  },
};

const DEFAULT_REQUIREMENTS: TypeRequirements = {
  essential: ["title", "source_type"],
  recommended: ["summary", "author"],
};

export interface CompletenessReport {
  score: CompletenessScore;
  presentEssential: string[];
  missingEssential: string[];
  presentRecommended: string[];
  missingRecommended: string[];
}

export function evaluateCompleteness(node: ParsedNode): CompletenessReport {
  const reqs = REQUIREMENTS_BY_TYPE[node.type] || DEFAULT_REQUIREMENTS;

  const presentEssential: string[] = [];
  const missingEssential: string[] = [];

  for (const field of reqs.essential) {
    if (field === "author" && !node.author) missingEssential.push(field);
    else if (field === "author" && node.author) presentEssential.push(field);
    else if (field === "summary" && !node.summary) missingEssential.push(field);
    else if (field === "summary" && node.summary) presentEssential.push(field);
    else if (field === "title" && !node.title) missingEssential.push(field);
    else if (field === "title" && node.title) presentEssential.push(field);
    else if (field === "source_type" && !node.source_type) missingEssential.push(field);
    else if (field === "source_type" && node.source_type) presentEssential.push(field);
    else {
      // generic fallback for essential fields that might be mapped differently or just not present
      missingEssential.push(field);
    }
  }

  const presentRecommended: string[] = [];
  const missingRecommended: string[] = [];

  for (const field of reqs.recommended) {
    if (field.startsWith("asset:")) {
      const category = field.split(":")[1];
      const hasAsset = node.assets?.some((a) => a.category === category);
      if (hasAsset) presentRecommended.push(field);
      else missingRecommended.push(field);
    } else if (field.startsWith("metadata:")) {
      const key = field.split(":")[1];
      if (node.metadata && node.metadata[key]) presentRecommended.push(field);
      else missingRecommended.push(field);
    } else {
      if (node.metadata && node.metadata[field]) presentRecommended.push(field);
      else if (field === "author" && node.author) presentRecommended.push(field);
      else if (field === "summary" && node.summary) presentRecommended.push(field);
      else missingRecommended.push(field);
    }
  }

  let score: CompletenessScore = "partial";
  if (missingEssential.length === reqs.essential.length) {
    score = "invalid";
  } else if (missingEssential.length > 0) {
    score = "minimal";
  } else if (missingEssential.length === 0 && missingRecommended.length === 0) {
    score = "complete";
  }

  return {
    score,
    presentEssential,
    missingEssential,
    presentRecommended,
    missingRecommended,
  };
}
