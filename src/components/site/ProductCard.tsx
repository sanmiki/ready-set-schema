import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/site/FavoriteButton";
import { Button } from "@/components/ui/button";
import { conditionLabel, formatPrice } from "@/lib/labels";
import { TIER_LABEL } from "@/lib/promotions";
import type { Listing } from "@/lib/types";

// One card in every grid: photo, title, price and the short meta line.
export function ProductCard({ listing }: { listing: Listing }) {
  const cover = listing.images.find((image) => image.src) ?? null;
  const meta = [listing.brand, listing.size].filter(Boolean).join(" · ");
  const sub = [conditionLabel(listing.condition), listing.city].filter(Boolean).join(" · ");

  return (
    <Link
      to="/product/$id"
      params={{ id: listing.id }}
      className={`group block rounded-2xl ${listing.highlighted ? "outline outline-1 outline-offset-[6px] outline-sage/60" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted transition-shadow duration-200 group-hover:shadow-lift">
        {cover?.src ? (
          <img
            src={cover.src}
            alt={listing.title}
            loading="lazy"
            width={640}
            height={800}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            ფოტო არ არის
          </div>
        )}

        <FavoriteButton productId={listing.id} className="absolute right-3 top-3" />

        {listing.status === "active" && !!listing.promoTier && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-background backdrop-blur">
            {TIER_LABEL[listing.promoTier]} · რეკლამა
          </span>
        )}

        {listing.status !== "active" && (
          <span className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            {listing.status === "sold" ? "გაყიდული" : listing.status === "reserved" ? "დაჯავშნული" : "გამოუქვეყნებელი"}
          </span>
        )}
      </div>

      <div className="mt-3 px-0.5">
        <p className="text-base font-semibold tracking-tight">{formatPrice(listing.price)}</p>
        <h3 className="mt-0.5 line-clamp-1 font-sans text-sm font-normal text-foreground">{listing.title}</h3>
        {meta && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meta}</p>}
        {sub && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] rounded-2xl bg-muted" />
      <div className="mt-3 h-4 w-1/4 rounded-full bg-muted" />
      <div className="mt-2 h-3.5 w-3/4 rounded-full bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
    </div>
  );
}

export function FeaturedBanner({ listing }: { listing: Listing }) {
  const cover = listing.images.find((image) => image.src) ?? null;
  return (
    <Link
      to="/product/$id"
      params={{ id: listing.id }}
      className="group relative flex min-h-[220px] items-end overflow-hidden rounded-3xl bg-muted p-6"
    >
      {cover?.src && (
        <img
          src={cover.src}
          alt={listing.title}
          loading="lazy"
          width={800}
          height={600}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
      <div className="relative">
        <p className="text-xs font-medium text-sage-deep">{listing.category?.name ?? "ნივთი"}</p>
        <h3 className="mt-1 text-xl">{listing.title}</h3>
        <p className="mt-1 text-sm font-semibold">{formatPrice(listing.price)}</p>
      </div>
    </Link>
  );
}

export function EmptyState({
  title,
  text,
  actionLabel,
  actionTo,
}: {
  title: string;
  text: string;
  actionLabel?: string | undefined;
  actionTo?: "/sell" | "/catalog" | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center surface px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-sage-deep">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-6.25 6.25L12 21l-2-2-6.25 2 2-6.25L1.5 12l6.25-6.25L12 1.5l2 2 6.25 2-2 6.25z" />
        </svg>
      </div>
      <h2 className="text-xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
      {actionLabel && actionTo && (
        <Button asChild className="mt-6 rounded-full">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
