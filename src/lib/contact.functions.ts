import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { publishableClient } from "./db";
import { normalizeGeorgianPhone, PHONE_ERROR } from "./phone";
import type { Result } from "./types";

export type ListingContact = { phone: string | null; isPublic: boolean; whatsapp: boolean };

// Public: only tells whether a live listing has an opted-in number.
export const listingHasPublicPhone = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => input)
  .handler(async ({ data }): Promise<boolean> => {
    const { data: has } = await publishableClient().rpc("listing_has_public_phone", { _product_id: data.productId });
    return has === true;
  });

// Public: returns the number only when the seller opted in and the listing is live.
export const revealListingPhone = createServerFn({ method: "POST" })
  .inputValidator((input: { productId: string }) => input)
  .handler(async ({ data }): Promise<string | null> => {
    const { data: phone } = await publishableClient().rpc("listing_public_phone", { _product_id: data.productId });
    return typeof phone === "string" ? phone : null;
  });

// Public: the WhatsApp number only when the seller enabled both public phone and WhatsApp on a live listing.
export const listingWhatsapp = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => input)
  .handler(async ({ data }): Promise<string | null> => {
    const { data: phone } = await publishableClient().rpc("listing_public_whatsapp", { _product_id: data.productId });
    return typeof phone === "string" ? phone : null;
  });

export const getMyListingContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<ListingContact> => {
    if (data.productId) {
      const { data: row } = await context.supabase
        .from("listing_contacts").select("phone,is_public,whatsapp_enabled").eq("product_id", data.productId).maybeSingle();
      if (row) return { phone: row.phone, isPublic: row.is_public, whatsapp: row.whatsapp_enabled };
    }
    const { data: own } = await context.supabase
      .from("seller_contacts").select("phone").eq("user_id", context.userId).maybeSingle();
    return { phone: own?.phone ?? null, isPublic: false, whatsapp: false };
  });

export const saveListingContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; phone: string; isPublic: boolean; whatsapp?: boolean }) => input)
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: owned } = await context.supabase
      .from("products").select("id").eq("id", data.productId).eq("seller_id", context.userId).maybeSingle();
    if (!owned) return { ok: false, message: "ეს ნივთი ვერ მოიძებნა." };

    if (!data.phone.trim()) {
      await context.supabase.from("listing_contacts").delete().eq("product_id", data.productId);
      return { ok: true, id: data.productId };
    }
    const phone = normalizeGeorgianPhone(data.phone);
    if (!phone) return { ok: false, message: PHONE_ERROR };

    const { error } = await context.supabase.from("listing_contacts").upsert({
      product_id: data.productId, phone, is_public: data.isPublic,
      whatsapp_enabled: data.isPublic && data.whatsapp === true, updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, message: "ნომრის შენახვა ვერ მოხერხდა." };
    return { ok: true, id: data.productId };
  });

export const getMyPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string | null> => {
    const { data } = await context.supabase.from("seller_contacts").select("phone").eq("user_id", context.userId).maybeSingle();
    return data?.phone ?? null;
  });

export const saveMyPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data, context }): Promise<Result> => {
    if (!data.phone.trim()) {
      await context.supabase.from("seller_contacts").delete().eq("user_id", context.userId);
      return { ok: true, id: context.userId };
    }
    const phone = normalizeGeorgianPhone(data.phone);
    if (!phone) return { ok: false, message: PHONE_ERROR };
    const { error } = await context.supabase.from("seller_contacts").upsert({
      user_id: context.userId, phone, updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, message: "ნომრის შენახვა ვერ მოხერხდა." };
    return { ok: true, id: context.userId };
  });
