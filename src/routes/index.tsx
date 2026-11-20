import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import hero from "@/assets/vintage-clothing-stack.png.asset.json";
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
      { title: "MEORADI — იყიდე და გაყიდე მეორადი ტანსაცმელი" },
      {
        name: "description",
        content:
          "MEORADI — თანამედროვე მარკეტი მეორადი ტანსაცმლისთვის საქართველოში. ფასები ლარში.",
      },
      { property: "og:title", content: "MEORADI — კარგ ნივთებს მეორე სიცოცხლე აქვთ" },
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
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: facets } = useSuspenseQuery(facetsQuery);
  const { data: listings } = useSuspenseQuery(listingsQuery({ sort: "new", limit: 16 }));

  const featured = listings.slice(0, 8);
  const recent = listings.slice(8, 16);
  const parents = categories.filter((category) => !category.parent_id);

  return (
    <>
      <section className="relative overflow-hidden bg-studio text-studio-foreground">
        <div className="mx-auto flex max-w-[1600px] flex-col lg:block lg:aspect-[16/8] lg:max-h-[720px] lg:min-h-[520px] lg:w-full">
          <img
            src={hero.url}
            alt="დაკეცილი ვინტაჟური ტანსაცმლის დასტა კეპით ბეჟისფერ ფონზე"
            width={1672}
            height={941}
            fetchPriority="high"
            className="order-2 aspect-[16/10] w-full object-cover object-[50%_60%] animate-in fade-in duration-700 lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:h-full lg:w-[72%] lg:object-cover lg:object-[15%_center] lg:[mask-image:linear-gradient(to_right,transparent,black_30%)]"
          />
          <div className="relative z-10 order-1 flex flex-col justify-center px-6 pb-4 pt-10 lg:h-full lg:max-w-[44%] lg:px-12 lg:py-0 lg:px-16">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.25em] opacity-70">MEORADI · მეორადი მოდა</p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl xl:text-7xl">
              მეორადი.
              <br />
              <span className="italic">მაგრამ გამორჩეული.</span>
            </h1>
            <p className="mt-5 max-w-md text-base opacity-80 md:text-lg">
              აღმოაჩინე შენი სტილი და მიეცი ნივთებს მეორე სიცოცხლე.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/catalog"
                search={{}}
                className="group inline-flex h-12 items-center gap-2 bg-foreground px-6 text-sm font-medium tracking-wide text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                აღმოაჩინე ნივთები
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/sell"
                className="inline-flex h-12 items-center border border-foreground px-6 text-sm font-medium tracking-wide transition-colors duration-300 hover:bg-foreground hover:text-background"
              >
                განათავსე განცხადება
              </Link>
            </div>
          </div>
        </div>
      </section>

      {parents.length > 0 && (
        <section className="container-page mt-14">
          <h2 className="mb-5 text-2xl">კატეგორიები</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
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
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-primary p-8 text-primary-foreground lg:flex-row lg:items-center lg:p-12">
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {items.map((listing) => (
          <ProductCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
