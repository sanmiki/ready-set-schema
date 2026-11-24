import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const acceptanceSchema = z.object({
  context: z.enum(["registration", "listing", "promotion"]),
  contextKey: z.string().min(8).max(100),
  productId: z.string().uuid().optional(),
  amountTetri: z.number().int().positive().optional(),
});

export const recordLegalAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof acceptanceSchema>) => acceptanceSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await context.supabase.rpc("record_legal_acceptance", {
      _context: data.context,
      _context_key: data.contextKey,
      ...(data.productId ? { _product_id: data.productId } : {}),
      ...(data.amountTetri ? { _amount_tetri: data.amountTetri } : {}),
    });
    if (error) {
      console.error("record_legal_acceptance", error);
      return { ok: false, message: "წესების მიღების ჩანაწერი ვერ შეინახა. სცადეთ თავიდან." };
    }
    return { ok: true };
  });
