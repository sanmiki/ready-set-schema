import type { Client } from "./db";
import type { LegalContext } from "./legal";

export async function recordPaidLegalConsent(
  client: Client,
  input: { context: Exclude<LegalContext, "registration">; contextKey: string; productId: string; amountTetri: number },
): Promise<boolean> {
  const { error } = await client.rpc("record_legal_acceptance", {
    _context: input.context,
    _context_key: input.contextKey,
    _product_id: input.productId,
    _amount_tetri: input.amountTetri,
  });
  if (error) console.error("record_legal_acceptance", error);
  return !error;
}
