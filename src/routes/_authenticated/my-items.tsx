import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/site/ProductCard";
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
import { deleteListing, setListingStatus } from "@/lib/seller.functions";
import { formatPrice, statusLabel } from "@/lib/labels";
import { myListingsQuery } from "@/lib/queries";
import type { Listing } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/my-items")({
  head: () => ({
    meta: [
      { title: "ჩემი ნივთები · ReWear" },
      { name: "description", content: "მართეთ გამოქვეყნებული ნივთები: ფასი, მდგომარეობა და სტატუსი." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ჩემი ნივთები · ReWear" },
      { property: "og:description", content: "ReWear — მეორადი მოდა საქართველოში." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myListingsQuery),
  component: MyItemsPage,
});

function MyItemsPage() {
  const { data: listings } = useSuspenseQuery(myListingsQuery);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">ჩემი ნივთები</h1>
          <p className="mt-1 text-sm text-muted-foreground">{listings.length} ჩანაწერი</p>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/sell">ახალი ნივთი</Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="ჯერ ნივთები არ დაგიმატებიათ"
            text="ატვირთეთ პირველი ნივთი — ფოტოები, ფასი და მდგომარეობა."
            actionLabel="დაიწყე გაყიდვა"
            actionTo="/sell"
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {listings.map((listing) => (
            <ItemRow key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ listing }: { listing: Listing }) {
  const queryClient = useQueryClient();

  async function changeStatus(status: "active" | "reserved" | "sold" | "draft") {
    const result = await setListingStatus({ data: { id: listing.id, status } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("სტატუსი განახლდა");
    await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
  }

  async function remove() {
    const result = await deleteListing({ data: { id: listing.id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("ნივთი წაიშალა");
    await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-3">
      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {listing.images[0]?.src && (
          <img
            src={listing.images[0].src}
            alt=""
            width={64}
            height={80}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to="/product/$id"
          params={{ id: listing.id }}
          className="block truncate font-medium hover:underline"
        >
          {listing.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatPrice(listing.price)} · {statusLabel(listing.status)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/sell/$id" params={{ id: listing.id }}>
            რედაქტირება
          </Link>
        </Button>
        {listing.status !== "active" && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("active")}>
            გამოქვეყნება
          </Button>
        )}
        {listing.status === "active" && (
          <>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("reserved")}>
              დაჯავშნა
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("sold")}>
              გაყიდულია
            </Button>
          </>
        )}
        {listing.status === "reserved" && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => void changeStatus("sold")}>
            გაყიდულია
          </Button>
        )}
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
                «{listing.title}» და მისი ფოტოები სამუდამოდ წაიშლება.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>გაუქმება</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>წაშლა</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
