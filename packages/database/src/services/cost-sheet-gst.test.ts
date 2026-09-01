import { describe, expect, it } from "vitest";
import { inferAutoColumnMap } from "./cost-excel-auto-map";

describe("GST column auto-map", () => {
  const lineDefs = [
    { id: "sale-id", key: "sale_value", label: "Sale Value", systemField: null },
    { id: "gst-id", key: "gst_amount", label: "GST applicable on Basic Sale Value", systemField: null },
    { id: "with-gst-id", key: "basic_with_gst", label: "Basic Salevalue with GST", systemField: null },
  ];

  it("maps GST on Sale Value to gst_amount not sale_value", () => {
    const headers = [
      "Villa No.",
      "Wing",
      "Salable Area (Sq.ft.)",
      "BASE RATE /SFT",
      "Sale Value (Basic Cost+Car Park)",
      "GST on Sale Value",
      "Basic Salevalue with GST",
    ];
    const map = inferAutoColumnMap(headers, lineDefs);
    expect(map["GST on Sale Value"]).toBe("gst-id");
    expect(map["Sale Value (Basic Cost+Car Park)"]).toBe("sale-id");
  });
});
