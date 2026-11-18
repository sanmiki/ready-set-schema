import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { FavoriteButton } from "@/components/site/FavoriteButton";
import { EmptyState, ProductCard, ProductCardSkeleton } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { myFavoritesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "რჩეულები · მეორადი" },
      { name: "description", content: "თქვენ მიერ შენახული მეორადი ნივთები მეორადზე." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "რჩეულები · მეორადი" },
      { property: "og:description", content: "შენახული ნივთები ერთ ადგილას." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myFavoritesQuery),
  pendingComponent: () => (
    <div className="container-page py-10">
      <h1 className="text-3xl">რჩეულები</h1>
      <p className="mt-1 text-sm text-muted-foreground">იტვირთება...</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </div>
  ),
  errorComponent: FavoritesError,
  component: FavoritesPage,
});

function FavoritesError() {
  const router = useRouter();
  return (
    <div className="container-page py-16 text-center" role="alert">
      <h1 className="text-2xl">რჩეულების ჩატვირთვა ვერ მოხერხდა</h1>
      <p className="mt-2 text-sm text-muted-foreground">შეამოწმეთ კავშირი და სცადეთ თავიდან.</p>
      <Button className="mt-6 rounded-full" onClick={() => void router.invalidate()}>
        თავიდან ცდა
      </Button>
    </div>
  );
}

function FavoritesPage() {
  const { data: entries } = useSuspenseQuery(myFavoritesQuery);
  const { isFavorite } = useFavorites();
  // Hide hearts the user just removed without waiting for the list to refetch.
  const visible = entries.filter((entry) => isFavorite(entry.product_id) || !entry.listing);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">რჩეულები</h1>
      <p className="mt-1 text-sm text-muted-foreground">{entries.length} შენახული ნივთი</p>

      {entries.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="რჩეულები ცარიელია"
            text="დააჭირეთ გულის ნიშანს ნებისმიერ ნივთზე და ის აქ შეინახება."
            actionLabel="კატალოგის ნახვა"
            actionTo="/catalog"
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(visible.length ? visible : entries).map((entry) =>
            entry.listing && entry.listing.status === "active" ? (
              <ProductCard key={entry.product_id} listing={entry.listing} />
            ) : (
              <div key={entry.product_id}>
                <div className="relative flex aspect-[4/5] items-center justify-center rounded-2xl border border-dashed border-border bg-muted px-4 text-center text-xs text-muted-foreground">
                  ეს ნივთი აღარ არის ხელმისაწვდომი
                  <FavoriteButton productId={entry.product_id} className="absolute right-3 top-3" />
                </div>
                <h3 className="mt-3 line-clamp-1 text-sm font-medium text-muted-foreground">
                  {entry.listing?.title ?? "მიუწვდომელი ნივთი"}
                </h3>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
