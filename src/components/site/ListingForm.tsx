import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { conditionLabel, formatPrice } from "@/lib/labels";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, MAX_PHOTOS, productImagePath, validatePhoto } from "@/lib/media";
import { CITIES, CONDITIONS, SIZES } from "@/lib/labels";
import { getMyListingContact, saveListingContact } from "@/lib/contact.functions";
import { normalizeGeorgianPhone, PHONE_ERROR } from "@/lib/phone";
import { useQuery } from "@tanstack/react-query";
import { createListing, deleteListing, finalizeListing, setListingImages, updateListing } from "@/lib/seller.functions";
import type { Category, Listing } from "@/lib/types";
import { canPayFromBalance, formatTetri } from "@/lib/pricing";
import { myWalletQuery } from "@/lib/queries";
import { firstMessage, listingFieldsSchema, type ListingFields } from "@/lib/validation";

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";
const fieldClass = "mt-1.5 h-11 rounded-xl transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-ring/20";

const SECTIONS = [
  { id: "photos", label: "ფოტოები" },
  { id: "basics", label: "ძირითადი ინფორმაცია" },
  { id: "details", label: "კატეგორია და მდგომარეობა" },
  { id: "price", label: "ფასი და მდებარეობა" },
  { id: "contact", label: "საკონტაქტო" },
] as const;

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="surface scroll-mt-28 p-5 sm:p-7">
      <h2 className="font-sans text-base font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// The price field is edited as text and coerced by the schema on submit.
type FormValues = Omit<ListingFields, "price"> & { price: string };

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

  const [values, setValues] = useState<FormValues>(() => ({
    title: listing?.title ?? "",
    description: listing?.description ?? "",
    brand: listing?.brand ?? "",
    size: listing?.size ?? "",
    color: listing?.color ?? "",
    condition: listing?.condition ?? "good",
    price: listing ? String(listing.price) : "",
    city: listing?.city ?? "",
    neighborhood: listing?.neighborhood ?? "",
    categorySlug: listing?.category?.slug ?? "",
  }));
  const [phone, setPhone] = useState<string | null>(null);
  const [phonePublic, setPhonePublic] = useState<boolean | null>(null);
  const [whatsapp, setWhatsapp] = useState<boolean | null>(null);
  const { data: contact } = useQuery({
    queryKey: ["my-listing-contact", user?.id ?? null, listing?.id ?? "new"],
    queryFn: () => getMyListingContact({ data: { productId: listing?.id } }),
    enabled: !!user,
  });
  const phoneValue = phone ?? contact?.phone ?? "";
  const phoneIsPublic = phonePublic ?? contact?.isPublic ?? false;
  const phoneValid = !!normalizeGeorgianPhone(phoneValue);
  const whatsappOn = phoneValid && phoneIsPublic && (whatsapp ?? contact?.whatsapp ?? false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<Listing["images"]>(listing?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalPhotos = keptPhotos.length + newPhotos.length;
  const firstNew = newPhotos[0];
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  useEffect(() => {
    if (keptPhotos[0]?.src) {
      setPreviewSrc(keptPhotos[0].src);
      return;
    }
    if (!firstNew) {
      setPreviewSrc(null);
      return;
    }
    const url = URL.createObjectURL(firstNew);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [keptPhotos, firstNew]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
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

    if (phoneValue.trim() && !normalizeGeorgianPhone(phoneValue)) {
      setError(PHONE_ERROR);
      toast.error(PHONE_ERROR);
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

        await saveListingContact({
          data: { productId: created.id, phone: phoneValue, isPublic: phoneIsPublic, whatsapp: whatsappOn },
        });

        const published = await finalizeListing({
          data: { id: created.id, paths: uploaded, publish: true },
        });
        if (!published.ok) {
          // The listing is saved as a draft; retry from "my items" instead of creating a duplicate.
          toast.error(published.message);
          await queryClient.invalidateQueries();
          navigate({ to: "/my-items" });
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

      const contactSaved = await saveListingContact({
        data: { productId: listing.id, phone: phoneValue, isPublic: phoneIsPublic, whatsapp: whatsappOn },
      });
      if (!contactSaved.ok) {
        setError(contactSaved.message);
        toast.error(contactSaved.message);
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
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:gap-8">
      <nav aria-label="ფორმის ნაწილები" className="hidden xl:block">
        <ol className="sticky top-24 space-y-0.5 border-l border-border text-sm">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 space-y-5">
      <Section id="photos" title="ფოტოები" hint={`მაქსიმუმ ${MAX_PHOTOS} ფოტო, თითო 10 მბ-მდე. პირველი ფოტო ბარათზე გამოჩნდება.`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-input bg-background text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-sage-soft hover:text-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
              <ImagePlus className="h-5 w-5" aria-hidden />
              <span>ფოტოს დამატება</span>
              <span className="text-[11px]">{totalPhotos}/{MAX_PHOTOS}</span>
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
      </Section>

      <Section id="basics" title="ძირითადი ინფორმაცია">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="title">სათაური</Label>
          <Input
            id="title"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder="მაგ. ჯინსის ქურთუკი Levi's"
            className={fieldClass}
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
            className="mt-1.5 rounded-xl transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-ring/20"
          />
        </div>
      </div>
      </Section>

      <Section id="details" title="კატეგორია და მდგომარეობა">
      <div className="grid gap-5 sm:grid-cols-2">
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
            className={fieldClass}
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
            className={fieldClass}
          />
        </div>

        <div>
          <Label htmlFor="condition">მდგომარეობა</Label>
          <select
            id="condition"
            value={values.condition}
            onChange={(event) => setField("condition", event.target.value as FormValues["condition"])}
            className={`${selectClass} mt-1.5`}
          >
            {CONDITIONS.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
        </div>

      </div>
      </Section>

      <Section id="price" title="ფასი და მდებარეობა">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="price">ფასი (₾)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={values.price}
            onChange={(event) => setField("price", event.target.value)}
            className={fieldClass}
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

        <div>
          <Label htmlFor="neighborhood">უბანი ან მიახლოებითი მდებარეობა</Label>
          <Input
            id="neighborhood"
            value={values.neighborhood ?? ""}
            onChange={(event) => setField("neighborhood", event.target.value)}
            placeholder="მაგ.: ვაკე"
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">ზუსტ მისამართს ნუ მიუთითებთ.</p>
        </div>
      </div>
      </Section>

      <Section id="contact" title="საკონტაქტო ნომერი" hint="არასავალდებულო — მყიდველები ყოველთვის შეძლებენ მოგწერონ შიდა ჩატით.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="phone">ტელეფონი (არასავალდებულო)</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneValue}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="555 12 34 56"
              className={fieldClass}
            />
          </div>
          <label className="flex items-start gap-3 self-end text-sm">
            <input
              type="checkbox"
              checked={phoneIsPublic}
              disabled={!phoneValue.trim()}
              onChange={(event) => setPhonePublic(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              ნომრის ჩვენება ამ განცხადებაზე
              <span className="block text-xs text-muted-foreground">
                ჩართვის შემთხვევაში ნებისმიერ ვიზიტორს შეეძლება ნომრის ნახვა და დარეკვა. გამორთვა ნებისმიერ დროს შეგიძლიათ.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm md:col-start-2">
            <input
              type="checkbox"
              checked={whatsappOn}
              disabled={!phoneValid || !phoneIsPublic}
              onChange={(event) => setWhatsapp(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              ამ ნომერზე WhatsApp-იც მაქვს
              <span className="block text-xs text-muted-foreground">
                ხელმისაწვდომია მხოლოდ მაშინ, როცა ნომრის ჩვენება ჩართულია.
              </span>
            </span>
          </label>
        </div>
      </Section>

      {mode === "create" && <ListingFeeNotice />}

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" size="lg" className="h-12 flex-1 rounded-full px-8 sm:flex-none" disabled={busy}>
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
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">გადახედვა</p>
          <div className="surface overflow-hidden p-3">
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-muted">
              {previewSrc ? (
                <img src={previewSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">ფოტო არ არის</div>
              )}
            </div>
            <div className="px-1 pb-1 pt-3">
              <p className="font-semibold">{values.price ? formatPrice(values.price) : "— ₾"}</p>
              <p className="mt-0.5 line-clamp-1 text-sm">{values.title || "ნივთის სათაური"}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {[conditionLabel(values.condition), values.city].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">ასე გამოჩნდება ნივთი კატალოგში.</p>
        </div>
      </aside>
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

function ListingFeeNotice() {
  const { user } = useSession();
  const { data } = useQuery(myWalletQuery(user?.id ?? null));
  if (!data) return null;
  if (data.nextFee === 0) {
    return (
      <section className="rounded-2xl bg-sage-soft px-5 py-4 text-sm font-medium text-sage-deep">
        პირველი განცხადება უფასოა
      </section>
    );
  }
  const enough = canPayFromBalance(data.balance, data.nextFee);
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="font-medium">განცხადების ატვირთვის საფასური: {formatTetri(data.nextFee)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-primary p-3">
          <p className="font-medium">ბალანსით გადახდა</p>
          <p className="text-xs text-muted-foreground">
            ბალანსი: {formatTetri(data.balance)}
            {enough ? "" : " — არასაკმარისია"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 opacity-60" aria-disabled>
          <p className="font-medium">ბარათით გადახდა</p>
          <p className="text-xs text-muted-foreground">დროებით მიუწვდომელია</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        გადასახდელი: {formatTetri(data.nextFee)}. რედაქტირება უფასოა.
        {enough ? "" : " ბალანსის გარეშე ნივთი მონახაზად შეინახება."}
      </p>
    </section>
  );
}
