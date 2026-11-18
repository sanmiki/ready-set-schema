import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";

import hero from "@/assets/hero.jpg";
import catWomen from "@/assets/cat-women.jpg";
import catMen from "@/assets/cat-men.jpg";
import catKids from "@/assets/cat-kids.jpg";
import catUnisex from "@/assets/cat-unisex.jpg";
import { EmptyState, ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { categoriesQuery, facetsQuery, listingsQuery } from "@/lib/queries";
import type { Category, Listing } from "@/lib/types";

const categoryImages: Record<string, string> = {
  women: catWomen,
  men: catMen,
  kids: catKids,
  unisex: catUnisex,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "მეორადი — იყიდე და გაყიდე მეორადი ტანსაცმელი" },
      {
        name: "description",
        content:
          "მეორადი — თანამედროვე მარკეტი მეორადი ტანსაცმლისთვის საქართველოში. ფასები ლარში.",
      },
      { property: "og:title", content: "მეორადი — კარგ ნივთებს მეორე სიცოცხლე აქვთ" },
      {
        property: "og:description",
        content: "აღმოაჩინე ხარისხიანი მეორადი ტანსაცმელი ან გაყიდე შენი.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(facetsQuery),
      context.queryClient.ensureQueryData(listingsQuery({ sort: "new", limit: 16 })),
    ]),
  component: Home,
});

function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: facets } = useSuspenseQuery(facetsQuery);
  const { data: listings } = useSuspenseQuery(listingsQuery({ sort: "new", limit: 16 }));

  const featured = listings.slice(0, 8);
  const recent = listings.slice(8, 16);
  const parents = categories.filter((category) => !category.parent_id);

  return (
    <>
      <section className="container-page pt-6 md:pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-muted">
          <img
            src={hero}
            alt="ტანსაცმლის საკიდი ნეიტრალურ ტონებში"
            width={1536}
            height={960}
            className="h-[460px] w-full object-cover md:h-[540px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-14">
            <p className="mb-3 text-sm font-medium text-sage-deep">მეორადი მოდა · საქართველო</p>
            <h1 className="max-w-xl text-4xl leading-tight md:text-6xl">მეორე სიცოცხლე შენს გარდერობს</h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              იყიდე ხარისხიანი ნივთები ნაკლებ ფასად, ან გაყიდე ის, რასაც აღარ ატარებ.
            </p>
            <form
              role="search"
              className="mt-6 flex max-w-lg gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ to: "/catalog", search: { q: query } });
              }}
            >
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="ძიება"
                  placeholder="მაგ. ჯინსის ქურთუკი"
                  className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-full px-6">
                ძიება
              </Button>
            </form>
            <Button asChild variant="outline" className="mt-4 w-fit rounded-full bg-card">
              <Link to="/sell">
                გაყიდე ნივთი <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {parents.length > 0 && (
        <section className="container-page mt-14">
          <h2 className="mb-5 text-2xl">კატეგორიები</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {parents.map((category) => (
              <CategoryTile key={category.id} category={category} />
            ))}
          </div>
        </section>
      )}

      {listings.length === 0 ? (
        <section className="container-page mt-14">
          <EmptyState
            title="ჯერ არც ერთი ნივთი არ არის გამოქვეყნებული"
            text="იყავი პირველი: ატვირთე ფოტოები, მიუთითე ფასი და ნივთი კატალოგში გამოჩნდება."
            actionLabel="დაიწყე გაყიდვა"
            actionTo="/sell"
          />
        </section>
      ) : (
        <>
          <Section title="რჩეული ნივთები" items={featured} />
          {recent.length > 0 && <Section title="ახლახან დამატებული" items={recent} />}
        </>
      )}

      {facets.brands.length > 0 && (
        <section className="container-page mt-14">
          <h2 className="mb-5 text-2xl">პოპულარული ბრენდები</h2>
          <div className="flex flex-wrap gap-2">
            {facets.brands.slice(0, 14).map((brand) => (
              <Link
                key={brand}
                to="/catalog"
                search={{ brand }}
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm transition hover:border-sage hover:bg-sage-soft"
              >
                {brand}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-page mt-14">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:p-12">
          <div>
            <h2 className="text-3xl">გარდერობის გაწმენდის დროა?</h2>
            <p className="mt-2 opacity-80">ატვირთე ნივთი ორ წუთში — უფასოდ.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <Link to="/sell">დაიწყე გაყიდვა</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function CategoryTile({ category }: { category: Category }) {
  const image = categoryImages[category.slug];
  return (
    <Link
      to="/catalog"
      search={{ category: category.slug }}
      className="group relative overflow-hidden rounded-2xl bg-muted"
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          width={1024}
          height={1280}
          className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center bg-sage-soft" />
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-card px-4 py-1.5 text-sm font-medium shadow-card">
        {category.name}
      </span>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: Listing[] }) {
  return (
    <section className="container-page mt-14">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-2xl">{title}</h2>
        <Link to="/catalog" search={{}} className="text-sm text-muted-foreground hover:text-foreground">
          ყველა →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {items.map((listing) => (
          <ProductCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
