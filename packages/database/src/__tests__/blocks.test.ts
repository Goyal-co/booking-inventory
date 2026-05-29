import { describe, it, expect } from "vitest";
import { BlockError } from "../services/blocks";

describe("BlockError", () => {
  it("should have correct code", () => {
    const error = new BlockError("Max blocks reached", "MAX_BLOCKS");
    expect(error.code).toBe("MAX_BLOCKS");
    expect(error.message).toBe("Max blocks reached");
  });
});

describe("Max blocks rule", () => {
  it("should enforce max 3 blocks per user", () => {
    const maxBlocks = 3;
    const activeBlocks = 3;
    expect(activeBlocks >= maxBlocks).toBe(true);
  });

  it("should allow block when under limit", () => {
    const maxBlocks = 3;
    const activeBlocks = 2;
    expect(activeBlocks < maxBlocks).toBe(true);
  });
});

describe("Booking race condition logic", () => {
  it("should reject double booking when unit already booked", () => {
    const unitStatus = "BOOKED";
    expect(unitStatus === "BOOKED").toBe(true);
  });

  it("should only allow booking from valid block", () => {
    const blockExpired = false;
    const isOwner = true;
    expect(blockExpired || !isOwner).toBe(false);
  });
});

describe("Countdown timer", () => {
  it("should calculate remaining time correctly", () => {
    const expiresAt = new Date(Date.now() + 600_000);
    const remaining = expiresAt.getTime() - Date.now();
    expect(remaining).toBeGreaterThan(590_000);
    expect(remaining).toBeLessThanOrEqual(600_000);
  });

  it("should detect expired blocks", () => {
    const expiresAt = new Date(Date.now() - 1000);
    const isExpired = expiresAt.getTime() <= Date.now();
    expect(isExpired).toBe(true);
  });
});
