import { describe, expect, it } from "vitest";
import { normalizeExcelSourceUrl } from "./cost-excel-live";

describe("normalizeExcelSourceUrl", () => {
  it("appends download=1 to SharePoint :x: personal share links", () => {
    const url =
      "https://goyalco1971-my.sharepoint.com/:x:/g/personal/online_goyalco1971_onmicrosoft_com/IQDVKnT2nDLOSYbeXaVFbs3zAfZbwUQYc0JYhnp8iSj3rQ4?e=vIjJTN";
    const normalized = normalizeExcelSourceUrl(url);
    expect(normalized).toContain("download=1");
    expect(normalized).toContain("e=vIjJTN");
  });

  it("does not duplicate download param", () => {
    const url = "https://contoso.sharepoint.com/:x:/g/personal/user/abc?e=token&download=1";
    expect(normalizeExcelSourceUrl(url)).toBe(url);
  });
});
