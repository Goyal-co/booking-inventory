import { describe, expect, it } from "vitest";
import { towerCodeFromName } from "./cost-excel-inventory";

describe("towerCodeFromName", () => {
  it("extracts wing/tower prefix codes", () => {
    expect(towerCodeFromName("Tower A")).toBe("A");
    expect(towerCodeFromName("Wing B")).toBe("B");
    expect(towerCodeFromName("Block C")).toBe("C");
  });

  it("falls back to alphanumeric slug", () => {
    expect(towerCodeFromName("North Block")).toBe("NORTHBLOCK");
  });
});
