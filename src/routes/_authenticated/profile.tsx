import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, avatarPath, validatePhoto } from "@/lib/media";
import { CITIES } from "@/lib/labels";
import { setProfileAvatar, updateMyProfile } from "@/lib/seller.functions";
import { myProfileQuery } from "@/lib/queries";
import type { ProfileFields } from "@/lib/validation";
import { firstMessage, profileFieldsSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "პროფილი · ReWear" },
      { name: "description", content: "შეავსეთ სახელი, ქალაქი და ცნობადი ReWear-ის პროფილზე." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "პროფილი · ReWear" },
      { property: "og:description", content: "ReWear — მეორადი მოდა საქართველოში." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myProfileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useSuspenseQuery(myProfileQuery);
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<ProfileFields>(() => ({
    username: profile?.username ?? "",
    display_name: profile?.display_name ?? "",
    city: profile?.city ?? "",
    bio: profile?.bio ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleAvatar(file: File) {
    if (!user) return;
    const problem = validatePhoto(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setUploading(true);
    try {
      const path = avatarPath(user.id, file);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (uploadError) {
        toast.error("სურათის ატვირთვა ვერ მოხერხდა.");
        return;
      }

      const saved = await setProfileAvatar({
        data: { path, previousPath: profile?.avatar_url ?? undefined },
      });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast("პროფილის სურათი განახლდა");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = profileFieldsSchema.safeParse(values);
    if (!parsed.success) {
      const message = firstMessage(parsed.error);
      setError(message);
      return;
    }

    setBusy(true);
    try {
      const saved = await updateMyProfile({ data: parsed.data });
      if (!saved.ok) {
        setError(saved.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast("პროფილი შენახულია");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">პროფილი</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ეს ინფორმაცია ნივთის გვერდზე გამოჩნდება.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-5">
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-sage-soft text-lg font-medium text-sage-deep">
          {profile?.avatar_src ? (
            <img src={profile.avatar_src} alt="" width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            (profile?.display_name || profile?.username || "?").slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "იტვირთება…" : "სურათის ცვლილება"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">JPG ან PNG, 10 მბ-მდე.</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleAvatar(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-5" noValidate>
        <div>
          <Label htmlFor="username">მომხმარებლის სახელი</Label>
          <Input
            id="username"
            value={values.username}
            onChange={(event) => setField("username", event.target.value)}
            placeholder="მაგ. nino.t"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            პატარა ასოები, ციფრები, წერტილი ან ქვედა ხაზი.
          </p>
        </div>

        <div>
          <Label htmlFor="display_name">სახელი</Label>
          <Input
            id="display_name"
            value={values.display_name ?? ""}
            onChange={(event) => setField("display_name", event.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="profile_city">ქალაქი</Label>
          <select
            id="profile_city"
            value={values.city ?? ""}
            onChange={(event) => setField("city", event.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
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
          <Label htmlFor="bio">ცნობადი</Label>
          <Textarea
            id="bio"
            rows={4}
            value={values.bio ?? ""}
            onChange={(event) => setField("bio", event.target.value)}
            placeholder="რას ყიდით, როგორ აგზავნით…"
            className="mt-1.5"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="rounded-full px-8" disabled={busy}>
          შენახვა
        </Button>
      </form>
    </div>
  );
}
