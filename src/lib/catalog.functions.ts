import { isAudience } from "./audience";
import { createServerFn } from "@tanstack/react-start";

import { hydrateListings, publishableClient, resolveCategoryId, type Client } from "./db";
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

type PromoState = { tier: number; highlighted: boolean; rankAt: number };

async function promoMap(client: Client): Promise<Map<string, PromoState>> {
  const { data } = await client.rpc("promoted_listings");
  return new Map(
    (data ?? []).map((row) => [
      row.product_id,
      { tier: row.tier_rank, highlighted: row.highlighted, rankAt: Date.parse(row.rank_at) },
    ]),
  );
}

function applyPromo(listings: Listing[], promos: Map<string, PromoState>): Listing[] {
  return listings.map((listing) => {
    const promo = promos.get(listing.id);
    return { ...listing, promoTier: promo?.tier ?? 0, highlighted: promo?.highlighted ?? false };
  });
}

// Promoted tiers first, then the bump/publication time, then id so ties never shuffle.
function promoOrder(promos: Map<string, PromoState>) {
  return (a: Listing, b: Listing) => {
    const pa = promos.get(a.id);
    const pb = promos.get(b.id);
    const tier = (pb?.tier ?? 0) - (pa?.tier ?? 0);
    if (tier !== 0) return tier;
    const time = (pb?.rankAt ?? Date.parse(b.created_at)) - (pa?.rankAt ?? Date.parse(a.created_at));
    if (time !== 0) return time;
    return a.id < b.id ? -1 : 1;
  };
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
    // Old links used audience roots as categories; treat them as audience.
    const audience = isAudience(data.audience) ? data.audience : isAudience(data.category) ? data.category : null;
    const productType = isAudience(data.category) ? undefined : data.category;
    if (productType) {
      const { data: all } = await client.from("categories").select("id,slug,parent_id");
      const rows = all ?? [];
      const root = rows.find((category) => category.slug === productType);
      if (!root) return [];

      // Product types repeat under several audiences ("ჯინსები"); match all.
      const { data: named } = await client.from("categories").select("id,name");
      const rootName = (named ?? []).find((c) => c.id === root.id)?.name;
      const wanted = new Set<string>((named ?? []).filter((c) => c.name === rootName).map((c) => c.id));
      wanted.add(root.id);
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

    const promos = await promoMap(client);
    const usePromoOrder = !data.sort || data.sort === "new";
    const build = () => {
    let query = client.from("products").select("*").eq("status", "active");

    if (categoryIds) query = query.in("category_id", categoryIds);
    if (audience) query = query.eq("audience", audience);
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

    return query;
    };

    const limit = Math.min(Math.max(data.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let query = build();
    if (data.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (data.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    const { data: rows } = await query.limit(limit);
    let all = rows ?? [];

    // Promoted or bumped listings that match the filters but fall outside the newest page.
    if (usePromoOrder && promos.size > 0) {
      const seen = new Set(all.map((row) => row.id));
      const missing = [...promos.keys()].filter((id) => !seen.has(id));
      if (missing.length > 0) {
        const { data: extra } = await build().in("id", missing);
        all = [...all, ...(extra ?? [])];
      }
    }

    let listings = applyPromo(await hydrateListings(client, all), promos);
    if (usePromoOrder) listings = listings.sort(promoOrder(promos)).slice(0, limit);
    return listings;
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

// Dedicated promoted section: SUPER VIP only, live listings only, never padded.
export const listPromotedListings = createServerFn({ method: "GET" })
  .inputValidator((input: { minTier: number; limit?: number }) => input)
  .handler(async ({ data }): Promise<Listing[]> => {
    const client = publishableClient();
    const promos = await promoMap(client);
    const ids = [...promos.entries()].filter(([, p]) => p.tier >= data.minTier).map(([id]) => id);
    if (ids.length === 0) return [];
    const { data: rows } = await client.from("products").select("*").eq("status", "active").in("id", ids);
    const listings = applyPromo(await hydrateListings(client, rows ?? []), promos);
    return listings.sort(promoOrder(promos)).slice(0, Math.min(data.limit ?? 8, 24));
  });
