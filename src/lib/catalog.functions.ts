import { createServerFn } from "@tanstack/react-start";

import { hydrateListings, publishableClient, resolveCategoryId } from "./db";
import type { Category, Facets, Listing, ListingQuery } from "./types";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 96;

// PostgREST's `or` filter is a mini language of its own, so anything that could
// be read as syntax is dropped before the term goes into the pattern.
function searchPattern(value: string | undefined): string {
  if (!value) return "";
  const cleaned = value.replace(/[%,()*]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? `%${cleaned}%` : "";
}

export const listCategories = createServerFn({ method: "GET" }).handler(async (): Promise<Category[]> => {
  const client = publishableClient();
  const { data } = await client.from("categories").select("id,name,slug,parent_id").order("name");
  return data ?? [];
});

export const listFacets = createServerFn({ method: "GET" }).handler(async (): Promise<Facets> => {
  const client = publishableClient();
  const { data, count } = await client
    .from("products")
    .select("brand,size,city")
    .eq("status", "active");

  const rows = data ?? [];
  const unique = (pick: (row: (typeof rows)[number]) => string | null) =>
    Array.from(new Set(rows.map(pick).filter((value): value is string => !!value))).sort((a, b) =>
      a.localeCompare(b, "ka"),
    );

  return {
    brands: unique((row) => row.brand),
    sizes: unique((row) => row.size),
    cities: unique((row) => row.city),
    total: count ?? rows.length,
  };
});

export const listListings = createServerFn({ method: "GET" })
  .inputValidator((input: ListingQuery) => input)
  .handler(async ({ data }): Promise<Listing[]> => {
    const client = publishableClient();

    let categoryIds: string[] | null = null;
    if (data.category) {
      const { data: all } = await client.from("categories").select("id,slug,parent_id");
      const rows = all ?? [];
      const root = rows.find((category) => category.slug === data.category);
      if (!root) return [];

      const wanted = new Set<string>([root.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const category of rows) {
          if (category.parent_id && wanted.has(category.parent_id) && !wanted.has(category.id)) {
            wanted.add(category.id);
            grew = true;
          }
        }
      }
      categoryIds = Array.from(wanted);
    }

    let query = client.from("products").select("*").eq("status", "active");

    if (categoryIds) query = query.in("category_id", categoryIds);
    if (data.brand) query = query.eq("brand", data.brand);
    if (data.size) query = query.eq("size", data.size);
    if (data.condition) query = query.eq("condition", data.condition);
    if (data.city) query = query.eq("city", data.city);
    if (typeof data.minPrice === "number") query = query.gte("price", data.minPrice);
    if (typeof data.maxPrice === "number") query = query.lte("price", data.maxPrice);

    const pattern = searchPattern(data.q);
    if (pattern) {
      query = query.or(`title.ilike.${pattern},brand.ilike.${pattern},description.ilike.${pattern}`);
    }

    if (data.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (data.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const limit = Math.min(Math.max(data.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { data: rows } = await query.limit(limit);

    return hydrateListings(client, rows ?? []);
  });

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Listing | null> => {
    const client = publishableClient();
    const { data: row } = await client
      .from("products")
      .select("*")
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();

    if (!row) return null;
    const [listing] = await hydrateListings(client, [row]);
    return listing ?? null;
  });

export const listRelatedListings = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string; categorySlug?: string | undefined }) => input)
  .handler(async ({ data }): Promise<Listing[]> => {
    const client = publishableClient();

    let query = client.from("products").select("*").eq("status", "active").neq("id", data.id);

    if (data.categorySlug) {
      const categoryId = await resolveCategoryId(client, data.categorySlug);
      if (categoryId) query = query.eq("category_id", categoryId);
    }

    const { data: rows } = await query.order("created_at", { ascending: false }).limit(4);
    return hydrateListings(client, rows ?? []);
  });
