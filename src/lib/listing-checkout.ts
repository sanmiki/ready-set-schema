import { z } from "zod";
import type { PromotionChoice } from "./promotions";
import type { Client } from "./db";

export const promotionChoiceSchema = z.object({
  tier: z.enum(["vip", "vip_plus", "super_vip"]).nullable(),
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  highlight: z.boolean(),
  bump: z.enum(["none", "once", "daily"]),
});
export const defaultPromotion: PromotionChoice = { tier: null, days: 3, highlight: false, bump: "none" };
export type ListingCheckoutQuote = { fee: number; promotion: number; total: number };

export async function saveCheckout(client: Client, productId: string, choice: PromotionChoice): Promise<ListingCheckoutQuote | null> {
  const { data, error } = await client.rpc("save_listing_checkout", {
    _product_id: productId, _tier: choice.tier as string, _days: choice.days, _highlight: choice.highlight, _bump: choice.bump,
  });
  const quote = data as ListingCheckoutQuote | null;
  if (error || !quote || !Number.isInteger(quote.total) || quote.total < 0) return null;
  return quote;
}