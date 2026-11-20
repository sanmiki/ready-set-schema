import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ProductCard } from "@/components/site/ProductCard";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { ContactSeller } from "@/components/site/ContactSeller";
import { ReportListing } from "@/components/site/ReportListing";
import { PhoneContact, WhatsAppContact } from "@/components/site/SellerContact";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { listingHasPublicPhone, listingWhatsapp } from "@/lib/contact.functions";
import { conditionLabel, formatDate, formatPrice, statusLabel } from "@/lib/labels";
import { deleteListing, setListingStatus } from "@/lib/seller.functions";
import { listingQuery, myListingQuery, relatedListingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ context, params }) => {
    const listing = await context.queryClient.ensureQueryData(listingQuery(params.id));
    if (!listing) throw notFound();
    await context.queryClient.ensureQueryData(
      relatedListingsQuery(params.id, listing.category?.slug ?? null),
    );
    return listing;
  },
  head: () => ({
    meta: [
      { title: "ნივთის გვერდი · MEORADI" },
      {
        name: "description",
        content:
          "ნივთის ფოტოები, ფასი, მდგომარეობა და გამყიდველი — MEORADI-ზე.",
      },
      { property: "og:title", content: "ნივთის გვერდი · MEORADI" },
      {
        property: "og:description",
        content: "იყიდე ხარისხიანი მეორადი ტანსაცმელი ნაკლებ ფასად.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQuery(id));
  const { user } = useSession();
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);

  const { data: mine } = useQuery({
    ...myListingQuery(id),
    enabled: !!user,
  });

  // The phone button appears only when the seller opted in on a live listing.
  const { data: waPhone } = useQuery({
    queryKey: ["listing-whatsapp", id],
    queryFn: () => listingWhatsapp({ data: { productId: id } }),
  });
  const { data: hasPhone } = useQuery({
    queryKey: ["listing-has-phone", id],
    queryFn: () => listingHasPublicPhone({ data: { productId: id } }),
    enabled: listing?.status === "active",
  });

  const { data: related } = useSuspenseQuery(
    relatedListingsQuery(id, listing?.category?.slug ?? null),
  );

  if (!listing) return null;

  const images = listing.images;
  const cover = images[activeImage] ?? images[0] ?? null;
  const isOwner = !!mine;

  async function changeStatus(status: "active" | "reserved" | "sold" | "draft") {
    const result = await setListingStatus({ data: { id, status } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("სტატუსი განახლდა");
    navigate({ to: "/my-items" });
  }

  async function removeListing() {
    const result = await deleteListing({ data: { id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("ნივთი წაიშალა");
    navigate({ to: "/my-items" });
  }

  return (
    <div className="container-page py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-muted">
            {cover?.src ? (
              <img src={cover.src} alt={listing.title} width={800} height={1000} className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                ფოტო არ არის
              </div>
            )}
            {listing.status !== "active" && (
              <span className="absolute left-4 top-4 rounded-full bg-card/95 px-3 py-1 text-xs font-medium backdrop-blur">
                {statusLabel(listing.status)}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={image.path}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted transition-[border-color,opacity] duration-200 ${
                    index === activeImage ? "border-sage" : "border-transparent"
                  }`}
                  aria-label={`ფოტო ${index + 1}`}
                >
                  {image.src && <img src={image.src} alt="" width={64} height={80} className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-sage-deep">{listing.category?.name ?? "ნივთი"}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-3xl md:text-4xl">{listing.title}</h1>
            <FavoriteButton productId={listing.id} className="h-11 w-11 shrink-0 border border-border" />
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight">{formatPrice(listing.price)}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 text-sm">
            <Meta label="მდგომარეობა" value={conditionLabel(listing.condition)} />
            <Meta label="ზომა" value={listing.size} />
            <Meta label="ბრენდი" value={listing.brand} />
            <Meta label="ფერი" value={listing.color} />
            <Meta
              label="მდებარეობა"
              value={[listing.city, listing.neighborhood].filter(Boolean).join(", ") || null}
            />
            <Meta label="დამატების თარიღი" value={formatDate(listing.created_at)} />
          </dl>

          {listing.description && (
            <div className="mt-6">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">გამყიდველის აღწერა</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>
            </div>
          )}

          {listing.seller && (
            <div className="mt-6 flex items-center gap-3 surface p-4">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-sage-soft text-sm font-medium text-sage-deep">
                {listing.seller.avatar_src ? (
                  <img src={listing.seller.avatar_src} alt="" width={44} height={44} className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]" />
                ) : (
                  listing.seller.username.slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {listing.seller.display_name || listing.seller.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{listing.seller.username}
                  {listing.seller.city ? ` · ${listing.seller.city}` : ""}
                </p>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
              <p className="text-sm font-medium">ეს თქვენი ნივთია</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full">
                  <a href={`/sell/${id}`}>რედაქტირება</a>
                </Button>
                {listing.status !== "active" && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("active")}>
                    გამოქვეყნება
                  </Button>
                )}
                {listing.status === "active" && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("reserved")}>
                    დაჯავშნა
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("sold")}>
                  გაყიდულია
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-full text-destructive">
                      წაშლა
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ნივთის წაშლა</AlertDialogTitle>
                      <AlertDialogDescription>
                        ნივთი და მისი ფოტოები სამუდამოდ წაიშლება. ეს მოქმედება უკან ვერ დაბრუნდება.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>გაუქმება</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void removeListing()}>წაშლა</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
          {listing.status === "active" && (
            <section className="mt-6 surface p-5">
              <h2 className="text-sm font-medium">გამყიდველთან დაკავშირება</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <PhoneContact productId={listing.id} hasPhone={hasPhone === true} />
                <WhatsAppContact productId={listing.id} title={listing.title} phone={waPhone} />
                <ContactSeller
                  productId={listing.id}
                  isOwner={isOwner}
                  variant={hasPhone ? "outline" : "default"}
                />
              </div>
              <ReportListing productId={listing.id} isOwner={isOwner} />
            </section>
          )}
        </div>
      </div>

      {related && related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-2xl">მსგავსი ნივთები</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      {images.length === 0 && (
        <div className="mt-12">
          <EmptyState title="ამ ნივთს ფოტო არ აქვს" text="მალე გავაუმჯობესებთ." />
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
