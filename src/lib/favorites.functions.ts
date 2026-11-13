import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { hydrateListings } from "./db";
import type { Listing, Result } from "./types";

export type FavoriteEntry = {
  product_id: string;
  created_at: string;
  // null when the item was taken off sale, sold or is otherwise not visible.
  listing: Listing | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listMyFavoriteIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", context.userId);
    if (error) throw new Error("რჩეულების ჩატვირთვა ვერ მოხერხდა.");
    return (data ?? []).map((row) => row.product_id);
  });

export const listMyFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteEntry[]> => {
    const { data: favs, error } = await context.supabase
      .from("favorites")
      .select("product_id,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("რჩეულების ჩატვირთვა ვერ მოხერხდა.");
    const rows = favs ?? [];
    if (rows.length === 0) return [];

    const { data: products } = await context.supabase
      .from("products")
      .select("*")
      .in("id", rows.map((row) => row.product_id));
    const listings = await hydrateListings(context.supabase, products ?? [], "proxy");
    const byId = new Map(listings.map((listing) => [listing.id, listing]));

    return rows.map((row) => ({
      product_id: row.product_id,
      created_at: row.created_at,
      listing: byId.get(row.product_id) ?? null,
    }));
  });

export const setFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; favorite: boolean }) => input)
  .handler(async ({ data, context }): Promise<Result> => {
    if (!UUID.test(data.productId)) return { ok: false, message: "ეს ნივთი ვერ მოიძებნა." };

    if (data.favorite) {
      const { error } = await context.supabase
        .from("favorites")
        .upsert(
          { user_id: context.userId, product_id: data.productId },
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      if (error) {
        if (error.code === "23503") return { ok: false, message: "ეს ნივთი აღარ არსებობს." };
        return { ok: false, message: "რჩეულებში დამატება ვერ მოხერხდა." };
      }
    } else {
      const { error } = await context.supabase
        .from("favorites")
        .delete()
        .eq("user_id", context.userId)
        .eq("product_id", data.productId);
      if (error) return { ok: false, message: "რჩეულებიდან წაშლა ვერ მოხერხდა." };
    }
    return { ok: true, id: data.productId };
  });
