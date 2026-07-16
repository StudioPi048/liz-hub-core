import { describe, it, expect } from "vitest";
import { evaluateCompleteness } from "./completeness";
import { ParsedNode } from "./parse";

describe("Completeness evaluation", () => {
  it("should return minimal if essential fields are missing", () => {
    const node = {
      type: "book",
      title: "Title",
      author: "",
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("minimal");
  });

  it("should return invalid if all essential fields are missing", () => {
    const node = {
      type: "book",
      title: "",
      author: "",
      summary: "",
      source_type: "",
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("invalid");
  });

  it("should return partial if all essentials are met but not all recommended", () => {
    const node = {
      type: "book",
      title: "Title",
      author: "Author",
      summary: "Summary",
      source_type: "source",
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("partial");
  });

  it("should return complete if all fields are met", () => {
    const node = {
      type: "book",
      title: "Title",
      author: "Author",
      summary: "Summary",
      source_type: "source",
      assets: [{ category: "cover" }, { category: "checkout" }, { category: "interior_pdf" }],
      metadata: { isbn: "123", publisher: "Ed" },
    } as unknown as ParsedNode;
    expect(evaluateCompleteness(node).score).toBe("complete");
  });
});
