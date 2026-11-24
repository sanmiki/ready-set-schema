import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { PromotionPrices } from "./promotions";
import { readPrices } from "./promotion-prices";
import { LEGAL_CONSENT_REQUIRED, paidServiceConsentError } from "./legal";
import { recordPaidLegalConsent } from "./legal-consent.server";

export type PromoteCheckout = {
  listing: { id: string; title: string; status: string } | null;
  prices: PromotionPrices;
  balance: number;
  active: { tier: string | null; highlight: boolean; bump_mode: string; ends_at: string }[];
};

export const getPromoteCheckout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PromoteCheckout> => {
    const client = context.supabase;
    const [listing, prices, balance, active] = await Promise.all([
      client.from("products").select("id,title,status").eq("id", data.id).eq("seller_id", context.userId).maybeSingle(),
      readPrices(client),
      client.rpc("wallet_balance"),
      client
        .from("listing_promotions")
        .select("tier,highlight,bump_mode,ends_at")
        .eq("product_id", data.id)
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false }),
    ]);
    return {
      listing: listing.data ?? null,
      prices,
      balance: balance.data ?? 0,
      active: active.data ?? [],
    };
  });

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  tier: z.enum(["vip", "vip_plus", "super_vip"]).nullable(),
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  highlight: z.boolean(),
  bump: z.enum(["none", "once", "daily"]),
  key: z.string().min(8).max(100),
  legalConsent: z.object({ accepted: z.boolean(), key: z.string().min(8).max(100) }),
});

const MESSAGES: Record<string, string> = {
  insufficient_balance: "ბალანსი არასაკმარისია. ონლაინ გადახდა მალე დაემატება.",
  not_found: "პრომო მხოლოდ თქვენს გამოქვეყნებულ ნივთზეა შესაძლებელი.",
  invalid: "აირჩიეთ ერთი სერვისი მაინც.",
  consent_required: LEGAL_CONSENT_REQUIRED,
};

export const purchasePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof purchaseSchema>) => purchaseSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { data: quoted, error: quoteError } = await context.supabase.rpc("promotion_quote", {
      _tier: data.tier as string, _days: data.days, _highlight: data.highlight, _bump: data.bump,
    });
    if (quoteError || quoted == null || quoted <= 0) return { ok: false, message: MESSAGES["invalid"]! };
    const consentError = paidServiceConsentError(quoted, data.legalConsent.accepted);
    if (consentError) return { ok: false, message: consentError };
    const recorded = await recordPaidLegalConsent(context.supabase, {
      context: "promotion", contextKey: data.key, productId: data.productId, amountTetri: quoted,
    });
    if (!recorded) return { ok: false, message: "ოპერაცია ვერ მოხერხდა. სცადეთ თავიდან." };

    const { data: result, error } = await context.supabase.rpc("purchase_promotion", {
      _product_id: data.productId,
      _tier: data.tier as string,
      _days: data.days,
      _highlight: data.highlight,
      _bump: data.bump,
      _key: data.key,
    });
    if (error) {
      console.error("purchase_promotion", error);
      return { ok: false, message: "ოპერაცია ვერ მოხერხდა. სცადეთ თავიდან." };
    }
    if (result === "purchased" || result === "duplicate") return { ok: true };
    return { ok: false, message: MESSAGES[result ?? ""] ?? "ოპერაცია ვერ მოხერხდა." };
  });

export const getPromotionPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readPrices(context.supabase));
