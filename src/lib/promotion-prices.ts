import type { Client } from "./db";
import type { PromotionPrices } from "./promotions";

export async function readPrices(client: Client): Promise<PromotionPrices> {
  const { data, error } = await client.rpc("promotion_price_list");
  if (error) throw new Error("prices");
  const map = Object.fromEntries((data ?? []).map((row) => [row.code, row.tetri]));
  return map as PromotionPrices;
}
