import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ListingForm } from "@/components/site/ListingForm";
import { categoriesQuery, myListingQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/sell_/$id")({
  head: () => ({
    meta: [
      { title: "ნივთის რედაქტირება · MEORADI" },
      { name: "description", content: "შეცვალეთ ნივთის ფოტოები, ფასი ან აღწერა." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ნივთის რედაქტირება · MEORADI" },
      { property: "og:description", content: "MEORADI — კარგ ნივთებს მეორე სიცოცხლე აქვთ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(myListingQuery(params.id)),
    ]).then(([, listing]) => {
      if (!listing) throw notFound();
      return listing;
    }),
  component: EditListingPage,
});

function EditListingPage() {
  const { id } = Route.useParams();
  const { data: listing } = useSuspenseQuery(myListingQuery(id));
  const { data: categories } = useSuspenseQuery(categoriesQuery);

  if (!listing) return null;

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="text-3xl tracking-tight md:text-4xl">ნივთის რედაქტირება</h1>
      <p className="mt-1 text-sm text-muted-foreground">{listing.title}</p>
      <div className="mt-8">
        <ListingForm mode="edit" listing={listing} categories={categories} />
      </div>
    </div>
  );
}
