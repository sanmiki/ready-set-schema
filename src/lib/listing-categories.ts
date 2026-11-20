// The fixed category list sellers can pick for listings, in display order.
export const LISTING_CATEGORIES = [
  { slug: "hoodies", name: "ჰუდები" },
  { slug: "pants", name: "შარვლები" },
  { slug: "tshirts", name: "მაისურები" },
  { slug: "two-piece-sets", name: "ორნაწილიანი ნაკრები" },
  { slug: "shirts", name: "პერანგები" },
  { slug: "jeans", name: "ჯინსები" },
  { slug: "dresses", name: "კაბები" },
  { slug: "socks", name: "წინდები" },
  { slug: "leggings", name: "ლეგინსები" },
  { slug: "bodysuits", name: "ბოდეები" },
  { slug: "skirts", name: "ქვედაბოლოები" },
  { slug: "evening-dresses", name: "გამოსაშვები კაბები" },
  { slug: "raincoats", name: "საწვიმარები" },
  { slug: "shorts", name: "შორტები" },
  { slug: "suits", name: "კოსტიუმები" },
  { slug: "wedding-dresses", name: "საქორწილო კაბები" },
  { slug: "tuxedos", name: "სმოკინგები" },
  { slug: "robes", name: "ხალათები" },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const isListingCategorySlug = (slug: string | undefined | null): boolean =>
  !!slug && LISTING_CATEGORIES.some((c) => c.slug === slug);

export const normalizeQuery = (s: string) => s.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");

// Georgian plural "-ები" and nominative "-ი"/"-ა" endings.
const stem = (w: string) => w.replace(/(ები|ებ|ი|ა|ე)$/u, "");

// Optimal string alignment distance (Levenshtein + adjacent transpositions).
function distance(a: string, b: string) {
  const A = Array.from(a), B = Array.from(b);
  const w = B.length + 1;
  const d = new Array<number>((A.length + 1) * w).fill(0);
  const at = (i: number, j: number) => d[i * w + j] ?? 0;
  for (let i = 0; i <= A.length; i++) d[i * w] = i;
  for (let j = 0; j <= B.length; j++) d[j] = j;
  for (let i = 1; i <= A.length; i++)
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) v = Math.min(v, at(i - 2, j - 2) + 1);
      d[i * w + j] = v;
    }
  return at(A.length, B.length);
}

export type CategorySearch = { matches: ListingCategory[]; suggestions: ListingCategory[] };

export function searchCategories(raw: string): CategorySearch {
  const q = normalizeQuery(raw);
  if (!q) return { matches: [...LISTING_CATEGORIES], suggestions: [] };
  const qs = stem(q);
  const ranked: { c: ListingCategory; score: number }[] = [];
  for (const c of LISTING_CATEGORIES) {
    const name = c.name;
    const words = name.split(" ");
    let score = -1;
    if (name === q) score = 0;
    else if (name.startsWith(q) || words.some((w) => w.startsWith(q))) score = 1;
    else if (name.includes(q)) score = 2;
    else if (qs.length >= 2 && words.some((w) => stem(w) === qs || stem(w).startsWith(qs))) score = 3;
    if (score >= 0) ranked.push({ c, score });
  }
  if (ranked.length) {
    ranked.sort((a, b) => a.score - b.score);
    return { matches: ranked.map((r) => r.c), suggestions: [] };
  }
  // Typo tolerance: only close spellings, scaled to query length.
  const limit = Array.from(q).length <= 3 ? 1 : Array.from(q).length <= 6 ? 2 : 3;
  const fuzzy: { c: ListingCategory; d: number }[] = [];
  for (const c of LISTING_CATEGORIES) {
    const d = Math.min(
      distance(q, c.name),
      ...c.name.split(" ").flatMap((w) => [distance(q, w), distance(qs, stem(w))]),
    );
    if (d <= limit) fuzzy.push({ c, d });
  }
  fuzzy.sort((a, b) => a.d - b.d);
  return { matches: [], suggestions: fuzzy.slice(0, 3).map((f) => f.c) };
}
