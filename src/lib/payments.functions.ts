import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEGAL_CONSENT_REQUIRED } from "./legal";
import { recordPaidLegalConsent } from "./legal-consent.server";

const startSchema = z.object({
  service: z.enum(["listing", "promotion"]),
  productId: z.string().uuid(),
  tier: z.enum(["vip", "vip_plus", "super_vip"]).nullable().default(null),
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]).default(1),
  highlight: z.boolean().default(false),
  bump: z.enum(["none", "once", "daily"]).default("none"),
  legalConsent: z.object({ accepted: z.literal(true), key: z.string().min(8).max(100) }),
});

const START_ERRORS: Record<string, string> = {
  disabled: "ონლაინ გადახდა ამჟამად გამორთულია.",
  not_found: "გადახდა მხოლოდ თქვენს ხელმისაწვდომ განცხადებაზეა შესაძლებელი.",
  already_paid: "ამ განცხადების საფასური უკვე გადახდილია.",
  phone_required: "გამოქვეყნებისთვის მიუთითეთ სწორი საკონტაქტო ნომერი.",
  free: "ეს გამოქვეყნება უფასოა — ბარათით გადახდა არ არის საჭირო.",
  invalid: "აირჩიეთ ერთი სერვისი მაინც.",
  duplicate: "ეს შეკვეთა უკვე დამუშავდა. განაახლეთ გვერდი.",
  consent_required: LEGAL_CONSENT_REQUIRED,
};

export const startCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof startSchema>) => startSchema.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | { ok: false; message: string }> => {
    const { flittConfig, createFlittCheckout } = await import("./flitt.server");
    const cfg = flittConfig();
    if (cfg.environment !== "sandbox") return { ok: false, message: START_ERRORS["disabled"]! };
    const db = context.supabase;

    // Price comes from the database, never from the browser.
    let amount: number;
    if (data.service === "promotion") {
      const { data: q } = await db.rpc("promotion_quote", { _tier: data.tier as string, _days: data.days, _highlight: data.highlight, _bump: data.bump });
      if (!q || q <= 0) return { ok: false, message: START_ERRORS["invalid"]! };
      amount = q;
    } else {
      const { data: fee } = await db.rpc("listing_fee_tetri" as never);
      amount = typeof fee === "number" && fee > 0 ? fee : 50;
    }
    const consentOk = await recordPaidLegalConsent(db, {
      context: data.service, contextKey: data.legalConsent.key, productId: data.productId, amountTetri: amount,
    });
    if (!consentOk) return { ok: false, message: "თანხმობის შენახვა ვერ მოხერხდა. სცადეთ თავიდან." };

    const { data: created, error } = await db.rpc("create_payment_order", {
      _service: data.service, _product_id: data.productId, _tier: data.tier as string, _days: data.days,
      _highlight: data.highlight, _bump: data.bump, _consent_key: data.legalConsent.key, _environment: cfg.environment,
    });
    const res = created as { id?: string; amount?: number; error?: string } | null;
    if (error || !res?.id || !res.amount) {
      if (error) console.error("create_payment_order", error.message);
      return { ok: false, message: START_ERRORS[res?.error ?? ""] ?? "გადახდის დაწყება ვერ მოხერხდა." };
    }
    const origin = new URL(getRequest().url).origin;
    try {
      const url = await createFlittCheckout({
        orderId: res.id,
        amountTetri: res.amount,
        description: data.service === "listing" ? "MEORADI listing fee" : "MEORADI promotion",
        responseUrl: `${origin}/api/public/flitt-return?pid=${res.id}`,
        callbackUrl: `${origin}/api/public/flitt-callback`,
      });
      return { ok: true, url };
    } catch {
      await db.rpc("cancel_payment_order", { _payment_id: res.id });
      return { ok: false, message: "გადახდის გვერდი ვერ გაიხსნა. სცადეთ მოგვიანებით." };
    }
  });

export type PaymentView = {
  id: string; service: string | null; amount_tetri: number; currency: string; status: string; environment: string;
  activation_result: string | null; failure_reason: string | null; product_id: string | null; created_at: string;
  confirmed_at: string | null; refund_status: string;
};
const COLS = "id,service,amount_tetri,currency,status,environment,activation_result,failure_reason,product_id,created_at,confirmed_at,refund_status";

export const getPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; sync?: boolean }) => z.object({ id: z.string().uuid(), sync: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }): Promise<PaymentView | null> => {
    const read = () => context.supabase.from("payments").select(COLS).eq("id", data.id).maybeSingle();
    let { data: row } = await read();
    if (!row) return null;
    if (row.status === "pending" && data.sync) {
      const { syncFromFlitt } = await import("./payments.server");
      try { await syncFromFlitt(row.id); } catch (e) { console.error("sync", e); }
      row = (await read()).data ?? row;
    }
    return row as PaymentView;
  });

export const cancelPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { syncFromFlitt } = await import("./payments.server");
    // Never cancel an order Flitt already approved.
    try { await syncFromFlitt(data.id); } catch { /* fall through */ }
    await context.supabase.rpc("cancel_payment_order", { _payment_id: data.id });
    return { ok: true };
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentView[]> => {
    const { data } = await context.supabase.from("payments").select(COLS).eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    return (data ?? []) as PaymentView[];
  });

export type AdminPayments = {
  payments: (PaymentView & { username: string; provider_payment_id: string | null; refunded_tetri: number })[];
  stats: { paid_count: number; paid_tetri: number; failed_count: number; pending_count: number; refunded_tetri: number; sandbox_paid_tetri: number };
  events: { id: string; payment_id: string | null; source: string; signature_valid: boolean | null; order_status: string | null; outcome: string; created_at: string }[];
};
export const adminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPayments> => {
    const { data, error } = await context.supabase.rpc("admin_payments", { _limit: 200 });
    if (error) throw new Error("forbidden");
    return data as unknown as AdminPayments;
  });
