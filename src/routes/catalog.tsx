import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { EmptyState, ProductCard, ProductCardSkeleton } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CITIES, CONDITIONS, SIZES, SORTS, type Sort } from "@/lib/labels";
import { categoriesQuery, facetsQuery, listingsQuery } from "@/lib/queries";
import type { ListingQuery } from "@/lib/types";

export type CatalogSearch = {
  q?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  size?: string | undefined;
  condition?: string | undefined;
  city?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  sort?: Sort | undefined;
};

const selectClass =
  "h-10 w-full rounded-full border border-input bg-card px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

function toQuery(search: CatalogSearch): ListingQuery {
  return {
    q: search.q,
    category: search.category,
    brand: search.brand,
    size: search.size,
    condition: search.condition,
    city: search.city,
    minPrice: search.min,
    maxPrice: search.max,
    sort: search.sort,
    limit: 60,
  };
}

function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  const amount = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  const sort = (value: unknown): Sort | undefined =>
    value === "new" || value === "price_asc" || value === "price_desc" ? value : undefined;

  return {
    q: text(raw["q"]),
    category: text(raw["category"]),
    brand: text(raw["brand"]),
    size: text(raw["size"]),
    condition: text(raw["condition"]),
    city: text(raw["city"]),
    min: amount(raw["min"]),
    max: amount(raw["max"]),
    sort: sort(raw["sort"]),
  };
}

export const Route = createFileRoute("/catalog")({
  validateSearch: parseCatalogSearch,
  head: () => ({
    meta: [
      { title: "კატალოგი · ReWear" },
      {
        name: "description",
        content: "მეორადი ტანსაცმლის კატალოგი ReWear-ზე: ქალები, კაცები, უნისექსი და ბავშვები.",
      },
      { property: "og:title", content: "კატალოგი · ReWear" },
      {
        property: "og:description",
        content: "იპოვე მეორადი ტანსაცმელი კატეგორიის, ზომის, მდგომარეობისა და ფასის მიხედვით.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, location }) => {
    const search = parseCatalogSearch(location.search);
    return Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(facetsQuery),
      context.queryClient.ensureQueryData(listingsQuery(toQuery(search))),
    ]);
  },
  component: Catalog,
});

function Catalog() {
  const search = useSearch({ from: "/catalog" });
  const navigate = useNavigate();

  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: facets } = useSuspenseQuery(facetsQuery);
  const { data: listings, isFetching } = useSuspenseQuery(listingsQuery(toQuery(search)));

  const items = listings;
  const parents = categories.filter((category) => !category.parent_id);
  const hasFilters =
    !!(search.q || search.category || search.brand || search.size || search.condition || search.city || search.min !== undefined || search.max !== undefined);

  function update(patch: CatalogSearch) {
    navigate({ to: "/catalog", search: { ...search, ...patch } });
  }

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">კატალოგი</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFetching ? "ვიძიებთ…" : `${items.length} ნივთი`}
          </p>
        </div>
        {hasFilters && (
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <a href="/catalog">
              <X className="mr-1 h-4 w-4" aria-hidden />
              ფილტრების გასუფთავება
            </a>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 rounded-3xl border border-border bg-card p-4 md:grid-cols-12">
        <form
          className="md:col-span-5"
          onSubmit={(event) => {
            event.preventDefault();
            const field = new FormData(event.currentTarget).get("q");
            update({ q: typeof field === "string" && field.trim() ? field.trim() : undefined });
          }}
        >
          <label className="relative block">
            <span className="sr-only">ძიება</span>
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={search.q ?? ""}
              placeholder="მაგ. ჯინსის ქურთუკი"
              className="h-10 rounded-full pl-11"
            />
          </label>
        </form>

        <select
          aria-label="კატეგორია"
          className={`${selectClass} md:col-span-3`}
          value={search.category ?? ""}
          onChange={(event) => update({ category: event.target.value || undefined })}
        >
          <option value="">ყველა კატეგორია</option>
          {parents.map((parent) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.slug}>{parent.name} — ყველა</option>
              {categories
                .filter((category) => category.parent_id === parent.id)
                .map((child) => (
                  <option key={child.id} value={child.slug}>
                    {child.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <select
          aria-label="ზომა"
          className={`${selectClass} md:col-span-2`}
          value={search.size ?? ""}
          onChange={(event) => update({ size: event.target.value || undefined })}
        >
          <option value="">ნებისმიერი ზომა</option>
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <select
          aria-label="მდგომარეობა"
          className={`${selectClass} md:col-span-2`}
          value={search.condition ?? ""}
          onChange={(event) => update({ condition: event.target.value || undefined })}
        >
          <option value="">ნებისმიერი მდგომარეობა</option>
          {CONDITIONS.map((condition) => (
            <option key={condition.value} value={condition.value}>
              {condition.label}
            </option>
          ))}
        </select>

        <select
          aria-label="ბრენდი"
          className={`${selectClass} md:col-span-3`}
          value={search.brand ?? ""}
          onChange={(event) => update({ brand: event.target.value || undefined })}
        >
          <option value="">ნებისმიერი ბრენდი</option>
          {facets.brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <select
          aria-label="ქალაქი"
          className={`${selectClass} md:col-span-3`}
          value={search.city ?? ""}
          onChange={(event) => update({ city: event.target.value || undefined })}
        >
          <option value="">ნებისმიერი ქალაქი</option>
          {Array.from(new Set([...CITIES, ...facets.cities])).map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 md:col-span-4">
          <Input
            type="number"
            min={0}
            aria-label="ფასი მინიმუმ"
            defaultValue={search.min ?? ""}
            placeholder="დან"
            className="h-10 rounded-full"
            onBlur={(event) => update({ min: event.target.value ? Number(event.target.value) : undefined })}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            aria-label="ფასი მაქსიმუმ"
            defaultValue={search.max ?? ""}
            placeholder="მდე"
            className="h-10 rounded-full"
            onBlur={(event) => update({ max: event.target.value ? Number(event.target.value) : undefined })}
          />
        </div>

        <select
          aria-label="დალაგება"
          className={`${selectClass} md:col-span-2`}
          value={search.sort ?? "new"}
          onChange={(event) => update({ sort: event.target.value === "new" ? undefined : (event.target.value as Sort) })}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="ვერცერთი ნივთი ვერ მოიძებნა"
            text="სცადეთ სხვა სიტყვა ან გაასუფთავეთ ფილტრები — ახალი ნივთები ყოველდღე ემატება."
          />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
          {isFetching && <ProductCardSkeleton />}
        </div>
      )}
    </div>
  );
}
