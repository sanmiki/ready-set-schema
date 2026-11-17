import { describe, expect, it } from "vitest";

import { canPayFromBalance, feeForNextListing, formatTetri, LISTING_FEE_TETRI } from "@/lib/pricing";

describe("listing fee", () => {
  it("first listing is free", () => expect(feeForNextListing(0)).toBe(0));
  it("second and later listings cost 50 tetri", () => {
    expect(feeForNextListing(1)).toBe(50);
    expect(feeForNextListing(7)).toBe(50);
  });
  it("insufficient balance blocks publication", () => {
    expect(canPayFromBalance(49, LISTING_FEE_TETRI)).toBe(false);
    expect(canPayFromBalance(50, LISTING_FEE_TETRI)).toBe(true);
  });
  it("shows 0.50 ₾", () => expect(formatTetri(50)).toBe("0.50 ₾"));
});
