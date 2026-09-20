import { describe, expect, it } from "vitest";
import { walkInLeadSchema } from "./index";

describe("walkInLeadSchema", () => {
  it("accepts name + phone only (production quick walk-in)", () => {
    const parsed = walkInLeadSchema.safeParse({
      customerName: "Pratham test",
      customerPhone: "9686602877",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts empty email / project fields from forms", () => {
    const parsed = walkInLeadSchema.safeParse({
      customerName: "Pratham test",
      customerPhone: "9686602877",
      customerEmail: "",
      projectId: "",
      projectName: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts projectName without projectId", () => {
    const parsed = walkInLeadSchema.safeParse({
      customerName: "Pratham test",
      customerPhone: "9686602877",
      projectName: "Orchid Life",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projectName).toBe("Orchid Life");
    }
  });

  it("rejects short phone", () => {
    const parsed = walkInLeadSchema.safeParse({
      customerName: "Pratham test",
      customerPhone: "123",
    });
    expect(parsed.success).toBe(false);
  });
});
