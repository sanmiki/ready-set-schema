import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { BUCKET } from "./media";
import type { Listing, ListingImage, Seller } from "./types";

export type Client = SupabaseClient<Database>;
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

// Signed media URLs are short-lived on purpose: the bucket is private, so every
// read goes through a URL the backend hands out with the listing data.
// The expiry is pinned to the next hour boundary (never below five minutes) so
// the server render and the browser render of the same page hand out the *same*
// URL — a per-request expiry would change every <img src> between the two.
const SIGN_WINDOW_SECONDS = 60 * 60;

function signWindowSeconds(): number {
  const now = Math.floor(Date.now() / 1000);
  const boundary =
    Math.floor(now / SIGN_WINDOW_SECONDS) * SIGN_WINDOW_SECONDS + SIGN_WINDOW_SECONDS;
  return Math.max(5 * 60, boundary - now);
}

export function publishableClient(): Client {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing backend environment variables");

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Opaque sb_ keys are not JWTs: send apikey only, never a bearer.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function signUrls(client: Client, paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((path) => path.length > 0)));
  if (unique.length === 0) return {};

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrls(unique, signWindowSeconds());
  const map: Record<string, string> = {};
  if (error || !data) return map;

  data.forEach((entry, index) => {
    const signedUrl = entry?.signedUrl;
    const fromEntry = entry && typeof (entry as { path?: unknown }).path === "string"
      ? (entry as { path: string }).path
      : undefined;
    const path = fromEntry ?? unique[index];
    if (signedUrl && path) map[path] = signedUrl;
  });

  return map;
}

// Turns raw product rows into the shape every screen renders: images with a
// viewable URL, the seller's public card, and the category name.
export async function hydrateListings(client: Client, rows: ProductRow[]): Promise<Listing[]> {
  if (rows.length === 0) return [];

  const productIds = rows.map((row) => row.id);
  const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id)));
  const categoryIds = Array.from(
    new Set(rows.map((row) => row.category_id).filter((id): id is string => id !== null)),
  );

  const imagesRes = await client
    .from("product_images")
    .select("product_id,storage_path,sort_order")
    .in("product_id", productIds)
    .order("sort_order");

  const sellersRes = await client
    .from("profiles")
    .select("id,username,display_name,city,avatar_url")
    .in("id", sellerIds);

  const categoriesRes = categoryIds.length > 0
    ? await client.from("categories").select("id,name,slug").in("id", categoryIds)
    : null;

  const imageRows = imagesRes.data ?? [];
  const sellerRows = sellersRes.data ?? [];
  const categoryRows = categoriesRes?.data ?? [];

  const urls = await signUrls(
    client,
    [
      ...imageRows.map((image) => image.storage_path),
      ...sellerRows.map((seller) => seller.avatar_url).filter((path): path is string => !!path),
    ],
  );

  const imagesByProduct = new Map<string, ListingImage[]>();
  for (const image of imageRows) {
    const bucket = imagesByProduct.get(image.product_id) ?? [];
    bucket.push({ path: image.storage_path, src: urls[image.storage_path] ?? null });
    imagesByProduct.set(image.product_id, bucket);
  }

  const sellers = new Map<string, Seller>();
  for (const seller of sellerRows) {
    sellers.set(seller.id, {
      username: seller.username,
      display_name: seller.display_name,
      city: seller.city,
      avatar_url: seller.avatar_url,
      avatar_src: seller.avatar_url ? (urls[seller.avatar_url] ?? null) : null,
    });
  }

  const categories = new Map(categoryRows.map((category) => [category.id, category]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    brand: row.brand,
    size: row.size,
    color: row.color,
    condition: row.condition as Listing["condition"],
    price: Number(row.price),
    city: row.city,
    status: row.status as Listing["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.category_id ? (categories.get(row.category_id) ?? null) : null,
    seller: sellers.get(row.seller_id) ?? null,
    images: imagesByProduct.get(row.id) ?? [],
  }));
}

export async function resolveCategoryId(
  client: Client,
  slug: string | undefined | null,
): Promise<string | null> {
  if (!slug) return null;
  const { data } = await client.from("categories").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}
