import { describe, expect, it } from "vitest";
import { addMesesISO } from "./financeiro.functions";

describe("addMesesISO", () => {
  it("soma meses mantendo o dia", () => {
    expect(addMesesISO("2026-07-10", 1)).toBe("2026-08-10");
    expect(addMesesISO("2026-07-10", 0)).toBe("2026-07-10");
  });

  it("recua para o ultimo dia quando o mes e mais curto", () => {
    expect(addMesesISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMesesISO("2028-01-31", 1)).toBe("2028-02-29"); // bissexto
    expect(addMesesISO("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("vira o ano", () => {
    expect(addMesesISO("2026-11-15", 3)).toBe("2027-02-15");
  });
});
