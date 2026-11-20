import type { Category } from "@/lib/types";

export const AUDIENCE_VALUES = ["men", "women", "kids", "unisex"] as const;
export type Audience = (typeof AUDIENCE_VALUES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  men: "კაცი",
  women: "ქალი",
  kids: "ბავშვი",
  unisex: "უნისექსი",
};

export const isAudience = (v: unknown): v is Audience =>
  typeof v === "string" && (AUDIENCE_VALUES as readonly string[]).includes(v);

// Audience roots (men/women/kids/unisex) are not product categories. Product
// types live beneath them, sometimes duplicated per audience (e.g. "ჯინსები");
// return each product type once, keyed by its first slug.
export function productTypeOptions(
  categories: Pick<Category, "id" | "name" | "slug" | "parent_id">[],
  currentSlug?: string,
) {
  const seen = new Map<string, { slug: string; name: string }>();
  for (const c of categories) {
    if (isAudience(c.slug) || !c.parent_id) continue;
    if (!seen.has(c.name) || c.slug === currentSlug) seen.set(c.name, { slug: c.slug, name: c.name });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "ka"));
}

// True when a slug is a real product type the form offers.
export function isProductTypeSlug(categories: Pick<Category, "id" | "name" | "slug" | "parent_id">[], slug: string | undefined) {
  if (!slug) return false;
  const c = categories.find((x) => x.slug === slug);
  return !!c && !!c.parent_id && !isAudience(c.slug);
}
