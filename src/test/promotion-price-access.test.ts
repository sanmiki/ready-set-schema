import { describe, expect, it, vi } from "vitest";

import type { Client } from "@/lib/db";
import { readPrices } from "@/lib/promotion-prices";

describe("promotion price access", () => {
  it("uses the controlled price read instead of direct table access", async () => {
    const from = vi.fn();
    const rpc = vi.fn(async (name: string) => {
      if (name !== "promotion_price_list") return { data: null, error: new Error("unexpected read") };
      return {
        data: [
          { code: "vip", tetri: 250 },
          { code: "vip_plus", tetri: 400 },
          { code: "super_vip", tetri: 900 },
          { code: "highlight", tetri: 50 },
          { code: "bump", tetri: 75 },
        ],
        error: null,
      };
    });

    const prices = await readPrices({ from, rpc } as unknown as Client);

    expect(prices).toEqual({ vip: 250, vip_plus: 400, super_vip: 900, highlight: 50, bump: 75 });
    expect(rpc).toHaveBeenCalledWith("promotion_price_list");
    expect(from).not.toHaveBeenCalled();
  });
});
