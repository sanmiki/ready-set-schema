import { describe, expect, it } from "vitest";
import { quoteTotal, type PromotionPrices } from "@/lib/promotions";

const prices: PromotionPrices = { vip: 250, vip_plus: 400, super_vip: 900, highlight: 50, bump: 75 };

describe("promotion pricing", () => {
  it("VIP 3 days = 7.50 ₾", () => expect(quoteTotal(prices, { tier: "vip", days: 3, highlight: false, bump: "none" })).toBe(750));
  it("VIP+ 1 day = 4.00 ₾", () => expect(quoteTotal(prices, { tier: "vip_plus", days: 1, highlight: false, bump: "none" })).toBe(400));
  it("SUPER VIP 7 days = 63 ₾", () => expect(quoteTotal(prices, { tier: "super_vip", days: 7, highlight: false, bump: "none" })).toBe(6300));
  it("highlight is 0.50 ₾ per day", () => expect(quoteTotal(prices, { tier: null, days: 7, highlight: true, bump: "none" })).toBe(350));
  it("one-time bump is 0.75 ₾", () => expect(quoteTotal(prices, { tier: null, days: 7, highlight: false, bump: "once" })).toBe(75));
  it("daily bump charges per day", () => expect(quoteTotal(prices, { tier: null, days: 3, highlight: false, bump: "daily" })).toBe(225));
  it("no promotion costs nothing", () => expect(quoteTotal(prices, { tier: null, days: 3, highlight: false, bump: "none" })).toBe(0));
});
