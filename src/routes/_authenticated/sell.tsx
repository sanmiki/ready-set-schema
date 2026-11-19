import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ListingForm } from "@/components/site/ListingForm";
import { categoriesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({
    meta: [
      { title: "ახალი ნივთი · MEORADI" },
      { name: "description", content: "ატვირთეთ ფოტოები, მიუთითეთ ფასი და გამოაქვეყნეთ ნივთი." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ახალი ნივთი · MEORADI" },
      { property: "og:description", content: "MEORADI — კარგ ნივთებს მეორე სიცოცხლე აქვთ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery),
  component: SellPage,
});

function SellPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="text-3xl tracking-tight md:text-4xl">ახალი ნივთის დამატება</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ფოტოები, ფასი და მდგომარეობა — ნივთი გამოქვეყნების შემდეგ კატალოგში გამოჩნდება.
      </p>
      <div className="mt-8">
        <ListingForm mode="create" categories={categories} />
      </div>
    </div>
  );
}
