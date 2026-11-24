import { describe, expect, it, vi } from "vitest";
import type { Client } from "@/lib/db";
import { defaultPromotion, saveCheckout } from "@/lib/listing-checkout";

describe("listing checkout pricing boundary", () => {
  it.each([
    ["first free listing", 0, 0, null, false, "none", 0],
    ["first free listing with VIP", 0, 750, "vip", false, "none", 750],
    ["paid standard listing", 50, 0, null, false, "none", 50],
    ["paid listing with VIP+", 50, 1200, "vip_plus", false, "none", 1250],
    ["paid listing with SUPER VIP", 50, 2700, "super_vip", false, "none", 2750],
    ["multiple selected services", 50, 1125, "vip", true, "daily", 1175],
  ] as const)("uses the backend total for %s", async (_name, fee, promotion, tier, highlight, bump, total) => {
    const rpc = vi.fn(async () => ({ data: { fee, promotion, total }, error: null }));
    const choice = { ...defaultPromotion, tier, highlight, bump };
    const quote = await saveCheckout({ rpc } as unknown as Client, "listing-id", choice);
    expect(quote?.total).toBe(total);
    expect(rpc).toHaveBeenCalledWith("save_listing_checkout", { _product_id: "listing-id", _tier: tier, _days: 3, _highlight: highlight, _bump: bump });
  });
  it("does not treat a failed quote as free publication", async () => {
    const rpc = vi.fn(async () => ({ data: { error: "not_found" }, error: null }));
    expect(await saveCheckout({ rpc } as unknown as Client, "listing-id", defaultPromotion)).toBeNull();
  });
});