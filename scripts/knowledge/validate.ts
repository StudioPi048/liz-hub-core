import path from "path";
import { ParsedNode } from "./parse";

const EXPECTED_TYPE_MAP: Record<string, string[]> = {
  livros: ["book"],
  cursos: ["course"],
  eventos: ["event"],
  produtos: ["product"],
  autores: ["author", "person"],
  faq: ["faq"],
  // Other domains are less strict or map to methodological/page
  psicogenealogia: ["methodological", "page", "educational"],
  cabala: ["methodological", "page", "educational"],
  "decodificacao-dental": ["methodological", "page", "educational"],
};

export interface ValidationError {
  file: string;
  error: string;
}

export function validateNode(node: ParsedNode): ValidationError | null {
  // Extract the immediate folder name under 'knowledge/'
  // e.g. "knowledge/livros/meu-livro.md" -> "livros"
  const normalizedUri = node.source_uri.replace(/\\/g, "/");
  const match = normalizedUri.match(/\/knowledge\/([^/]+)\//);

  if (match) {
    const folder = match[1];
    const expectedTypes = EXPECTED_TYPE_MAP[folder];

    if (expectedTypes && !expectedTypes.includes(node.type)) {
      return {
        file: node.source_uri,
        error: `Type mismatch: file is in '${folder}' folder but has type '${node.type}'. Expected one of: ${expectedTypes.join(", ")}`,
      };
    }
  }

  return null;
}
