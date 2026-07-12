import { describe, it, expect } from "vitest";
import { evaluateCompleteness } from "./completeness";
import type { ParsedNode } from "./parse";

describe("Completeness evaluation", () => {
  it("should return minimal if essential fields are missing", () => {
    const node = { type: "book", title: "Test" } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("minimal");
  });

  it("should return invalid if all essential fields are missing", () => {
    const node = { type: "book", id: "123" } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("invalid");
  });

  it("should return partial if all essentials are met but not all recommended", () => {
    const node = {
      type: "book",
      title: "Test",
      author: "LIZ",
      summary: "Resumo",
      source_type: "file",
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("partial");
  });

  it("should return complete if all fields are met", () => {
    const node = {
      type: "book",
      title: "Test",
      author: "LIZ",
      summary: "Resumo",
      source_type: "file",
      metadata: { cover: "1.jpg", subtitle: "Sub", publisher: "Ed", isbn: "123", links: [] },
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("complete");
  });
});
