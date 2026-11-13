import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, MAX_PHOTOS, productImagePath, validatePhoto } from "@/lib/media";
import { CITIES, CONDITIONS, SIZES } from "@/lib/labels";
import { createListing, deleteListing, finalizeListing, setListingImages, updateListing } from "@/lib/seller.functions";
import type { Category, Listing } from "@/lib/types";
import { firstMessage, listingFieldsSchema, type ListingFields } from "@/lib/validation";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

// Shared by the publish form and the edit form: fields, photos, validation and
// the save-to-database flow.
export function ListingForm({
  mode,
  listing,
  categories,
}: {
  mode: "create" | "edit";
  listing?: Listing | undefined;
  categories: Category[];
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<ListingFields>(() => ({
    title: listing?.title ?? "",
    description: listing?.description ?? "",
    brand: listing?.brand ?? "",
    size: listing?.size ?? "",
    color: listing?.color ?? "",
    condition: listing?.condition ?? "good",
    price: listing ? listing.price : "",
    city: listing?.city ?? "",
    categorySlug: listing?.category?.slug ?? "",
  }));
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<Listing["images"]>(listing?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalPhotos = keptPhotos.length + newPhotos.length;

  function setField<K extends keyof ListingFields>(key: K, value: ListingFields[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    for (const file of incoming) {
      const problem = validatePhoto(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      if (totalPhotos + accepted.length >= MAX_PHOTOS) {
        toast.error(`მაქსიმუმ ${MAX_PHOTOS} ფოტოა შესაძლებელი.`);
        break;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setNewPhotos((current) => [...current, ...accepted]);
  }

  async function uploadNewFiles(productId: string): Promise<string[]> {
    if (!user) throw new Error("no session");
    const paths: string[] = [];
    for (const [index, file] of newPhotos.entries()) {
      const path = productImagePath(user.id, productId, keptPhotos.length + index, file);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      paths.push(path);
    }
    return paths;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = listingFieldsSchema.safeParse(values);
    if (!parsed.success) {
      const message = firstMessage(parsed.error);
      setError(message);
      toast.error(message);
      return;
    }

    if (totalPhotos === 0) {
      const message = "ატვირთეთ ერთი ფოტო მაინც.";
      setError(message);
      toast.error(message);
      return;
    }

    setBusy(true);
    try {
      if (mode === "create") {
        const created = await createListing({ data: parsed.data });
        if (!created.ok) {
          setError(created.message);
          toast.error(created.message);
          return;
        }

        let uploaded: string[] = [];
        try {
          uploaded = await uploadNewFiles(created.id);
        } catch {
          await deleteListing({ data: { id: created.id } });
          const message = "ფოტოს ატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.";
          setError(message);
          toast.error(message);
          return;
        }

        const published = await finalizeListing({
          data: { id: created.id, paths: uploaded, publish: true },
        });
        if (!published.ok) {
          setError(published.message);
          toast.error(published.message);
          return;
        }

        await queryClient.invalidateQueries();
        toast.success("ნივთი გამოქვეყნდა");
        navigate({ to: "/product/$id", params: { id: created.id } });
        return;
      }

      if (!listing) return;

      const saved = await updateListing({ data: { id: listing.id, fields: parsed.data } });
      if (!saved.ok) {
        setError(saved.message);
        toast.error(saved.message);
        return;
      }

      let uploaded: string[] = [];
      try {
        uploaded = await uploadNewFiles(listing.id);
      } catch {
        const message = "ფოტოს ატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.";
        setError(message);
        toast.error(message);
        return;
      }

      const imagesSaved = await setListingImages({
        data: { id: listing.id, paths: [...keptPhotos.map((image) => image.path), ...uploaded] },
      });
      if (!imagesSaved.ok) {
        setError(imagesSaved.message);
        toast.error(imagesSaved.message);
        return;
      }

      await queryClient.invalidateQueries();
      toast.success("ცვლილებები შენახულია");
      navigate({ to: "/product/$id", params: { id: listing.id } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section>
        <h2 className="text-xl">ფოტოები</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          მაქსიმუმ {MAX_PHOTOS} ფოტო, თითო 10 მბ-მდე. პირველი ფოტო ბარათზე გამოჩნდება.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {keptPhotos.map((image) => (
            <div key={image.path} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              {image.src && (
                <img src={image.src} alt="" width={200} height={200} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setKeptPhotos((current) => current.filter((item) => item.path !== image.path))}
                className="absolute right-1 top-1 rounded-full bg-card/90 p-1 text-foreground transition hover:bg-card"
                aria-label="ფოტოს წაშლა"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {newPhotos.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                width={200}
                height={200}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setNewPhotos((current) => current.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 rounded-full bg-card/90 p-1 text-foreground transition hover:bg-card"
                aria-label="ფოტოს წაშლა"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {totalPhotos < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition hover:border-sage hover:bg-sage-soft">
              <ImagePlus className="h-5 w-5" aria-hidden />
              <span>აირჩიე</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="title">სათაური</Label>
          <Input
            id="title"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder="მაგ. ჯინსის ქურთუკი Levi's"
            className="mt-1.5"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description">აღწერა</Label>
          <Textarea
            id="description"
            value={values.description ?? ""}
            onChange={(event) => setField("description", event.target.value)}
            rows={5}
            placeholder="მდგომარეობა, ნაკლოვანებები, ზომის თავისებურებები…"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="category">კატეგორია</Label>
          <select
            id="category"
            value={values.categorySlug ?? ""}
            onChange={(event) => setField("categorySlug", event.target.value)}
            className={`${selectClass} mt-1.5`}
          >
            <option value="">არ არის მითითებული</option>
            {categoryOptions(categories)}
          </select>
        </div>

        <div>
          <Label htmlFor="brand">ბრენდი</Label>
          <Input
            id="brand"
            value={values.brand ?? ""}
            onChange={(event) => setField("brand", event.target.value)}
            placeholder="მაგ. Zara"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="size">ზომა</Label>
          <select
            id="size"
            value={values.size ?? ""}
            onChange={(event) => setField("size", event.target.value)}
            className={`${selectClass} mt-1.5`}
          >
            <option value="">არ არის მითითებული</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="color">ფერი</Label>
          <Input
            id="color"
            value={values.color ?? ""}
            onChange={(event) => setField("color", event.target.value)}
            placeholder="მაგ. ლურჯი"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="condition">მდგომარეობა</Label>
          <select
            id="condition"
            value={values.condition}
            onChange={(event) => setField("condition", event.target.value as ListingFields["condition"])}
            className={`${selectClass} mt-1.5`}
          >
            {CONDITIONS.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="price">ფასი (₾)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={values.price}
            onChange={(event) => setField("price", event.target.value as ListingFields["price"])}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="city">ქალაქი</Label>
          <select
            id="city"
            value={values.city ?? ""}
            onChange={(event) => setField("city", event.target.value)}
            className={`${selectClass} mt-1.5`}
          >
            <option value="">არ არის მითითებული</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="rounded-full px-8" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {mode === "create" ? "გამოქვეყნება" : "ცვლილებების შენახვა"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="rounded-full"
          disabled={busy}
          onClick={() => navigate({ to: mode === "create" ? "/catalog" : "/my-items" })}
        >
          გაუქმება
        </Button>
      </div>
    </form>
  );
}

// Parents first, then their children indented, so one flat list still reads as a tree.
function categoryOptions(categories: Category[]) {
  const parents = categories.filter((category) => !category.parent_id);
  const childrenOf = (parentId: string) => categories.filter((category) => category.parent_id === parentId);

  return parents.map((parent) => (
    <optgroup key={parent.id} label={parent.name}>
      <option value={parent.slug}>{parent.name} — ყველა</option>
      {childrenOf(parent.id).map((child) => (
        <option key={child.id} value={child.slug}>
          {child.name}
        </option>
      ))}
    </optgroup>
  ));
}
