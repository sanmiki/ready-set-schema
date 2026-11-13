import { createServerFn } from "@tanstack/react-start";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { hydrateListings, resolveCategoryId, signUrls } from "./db";
import { BUCKET, MAX_PHOTOS } from "./media";
import type { Listing, Profile, Result } from "./types";
import { firstMessage, listingFieldsSchema, profileFieldsSchema } from "./validation";

type Status = Database["public"]["Enums"]["product_status"];
type Ok = Result;

const NOT_FOUND = "ეს ნივთი ვერ მოიძებნა.";
const TRY_AGAIN = "ოპერაცია ვერ მოხერხდა. სცადეთ თავიდან.";

function fieldsOrMessage(input: unknown) {
  const parsed = listingFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: firstMessage(parsed.error) };
  return { ok: true as const, values: parsed.data };
}

async function ownedProductId(
  client: Parameters<typeof hydrateListings>[0],
  userId: string,
  id: string,
): Promise<string | null> {
  const { data } = await client
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("seller_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Parameters<typeof fieldsOrMessage>[0]) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const fields = fieldsOrMessage(data);
    if (!fields.ok) return fields;

    const categoryId = await resolveCategoryId(context.supabase, fields.values.categorySlug);

    const { data: created, error } = await context.supabase
      .from("products")
      .insert({
        seller_id: context.userId,
        title: fields.values.title,
        description: fields.values.description ?? "",
        brand: fields.values.brand || null,
        size: fields.values.size || null,
        color: fields.values.color || null,
        condition: fields.values.condition,
        price: fields.values.price,
        city: fields.values.city || null,
        category_id: categoryId,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !created) return { ok: false, message: TRY_AGAIN };
    return { ok: true, id: created.id };
  });

// Attaches the uploaded photos and, for a new listing, puts it on sale.
export const finalizeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; paths: string[]; publish: boolean }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const paths = data.paths.filter((path) => path.length > 0).slice(0, MAX_PHOTOS);
    if (data.publish && paths.length === 0) return { ok: false, message: "ატვირთეთ ერთი ფოტო მაინც." };

    const owned = await ownedProductId(context.supabase, context.userId, data.id);
    if (!owned) return { ok: false, message: NOT_FOUND };

    if (paths.length > 0) {
      const rows = paths.map((path, index) => ({
        product_id: data.id,
        storage_path: path,
        sort_order: index,
      }));
      const { error } = await context.supabase.from("product_images").insert(rows);
      if (error) return { ok: false, message: "ფოტოების მიმაგრება ვერ მოხერხდა." };
    }

    const { error } = await context.supabase
      .from("products")
      .update({ status: (data.publish ? "active" : "draft") as Status })
      .eq("id", data.id)
      .eq("seller_id", context.userId);

    if (error) return { ok: false, message: TRY_AGAIN };
    return { ok: true, id: data.id };
  });

export const updateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; fields: unknown }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const parsed = listingFieldsSchema.safeParse(data.fields);
    if (!parsed.success) return { ok: false, message: firstMessage(parsed.error) };

    const owned = await ownedProductId(context.supabase, context.userId, data.id);
    if (!owned) return { ok: false, message: NOT_FOUND };

    const categoryId = await resolveCategoryId(context.supabase, parsed.data.categorySlug);

    const { error } = await context.supabase
      .from("products")
      .update({
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        brand: parsed.data.brand || null,
        size: parsed.data.size || null,
        color: parsed.data.color || null,
        condition: parsed.data.condition,
        price: parsed.data.price,
        city: parsed.data.city || null,
        category_id: categoryId,
      })
      .eq("id", data.id)
      .eq("seller_id", context.userId);

    if (error) return { ok: false, message: TRY_AGAIN };
    return { ok: true, id: data.id };
  });

// Replaces the photo set of a listing and deletes files that are no longer used.
export const setListingImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; paths: string[] }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const paths = Array.from(new Set(data.paths.filter((path) => path.length > 0))).slice(0, MAX_PHOTOS);

    const owned = await ownedProductId(context.supabase, context.userId, data.id);
    if (!owned) return { ok: false, message: NOT_FOUND };

    const { data: current } = await context.supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", data.id);

    const keep = new Set(paths);
    const stale = (current ?? []).map((row) => row.storage_path).filter((path) => !keep.has(path));

    const { error: deleteError } = await context.supabase
      .from("product_images")
      .delete()
      .eq("product_id", data.id);
    if (deleteError) return { ok: false, message: "ფოტოების განახლება ვერ მოხერხდა." };

    if (paths.length > 0) {
      const rows = paths.map((path, index) => ({
        product_id: data.id,
        storage_path: path,
        sort_order: index,
      }));
      const { error } = await context.supabase.from("product_images").insert(rows);
      if (error) return { ok: false, message: "ფოტოების განახლება ვერ მოხერხდა." };
    }

    if (stale.length > 0) await context.supabase.storage.from(BUCKET).remove(stale);

    return { ok: true, id: data.id };
  });

export const setListingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: Status }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const owned = await ownedProductId(context.supabase, context.userId, data.id);
    if (!owned) return { ok: false, message: NOT_FOUND };

    const { error } = await context.supabase
      .from("products")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("seller_id", context.userId);

    if (error) return { ok: false, message: TRY_AGAIN };
    return { ok: true, id: data.id };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const owned = await ownedProductId(context.supabase, context.userId, data.id);
    if (!owned) return { ok: false, message: NOT_FOUND };

    const { data: images } = await context.supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", data.id);

    const paths = (images ?? []).map((row) => row.storage_path);
    if (paths.length > 0) await context.supabase.storage.from(BUCKET).remove(paths);

    const { error } = await context.supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", context.userId);

    if (error) return { ok: false, message: TRY_AGAIN };
    return { ok: true, id: data.id };
  });

export const listMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Listing[]> => {
    const { data: rows } = await context.supabase
      .from("products")
      .select("*")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });

    return hydrateListings(context.supabase, rows ?? [], "signed");
  });

export const getMyListing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<Listing | null> => {
    const { data: row } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .maybeSingle();

    if (!row) return null;
    const [listing] = await hydrateListings(context.supabase, [row], "signed");
    return listing ?? null;
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile | null> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,city,bio,created_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (!data) return null;

    const urls = data.avatar_url ? await signUrls(context.supabase, [data.avatar_url]) : {};

    return {
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      avatar_src: data.avatar_url ? (urls[data.avatar_url] ?? null) : null,
      city: data.city,
      bio: data.bio,
      created_at: data.created_at,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const parsed = profileFieldsSchema.safeParse(data);
    if (!parsed.success) return { ok: false, message: firstMessage(parsed.error) };

    const { error } = await context.supabase
      .from("profiles")
      .update({
        username: parsed.data.username,
        display_name: parsed.data.display_name || null,
        city: parsed.data.city || null,
        bio: parsed.data.bio || null,
      })
      .eq("id", context.userId);

    if (error) {
      if (error.code === "23505") return { ok: false, message: "ეს მომხმარებლის სახელი უკვე დაკავებულია." };
      if (error.code === "23514") return { ok: false, message: "მონაცემები ვერ მიიღო სისტემამ." };
      return { ok: false, message: TRY_AGAIN };
    }
    return { ok: true, id: context.userId };
  });

export const setProfileAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; previousPath?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<Ok> => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ avatar_url: data.path })
      .eq("id", context.userId);

    if (error) return { ok: false, message: TRY_AGAIN };

    if (data.previousPath && data.previousPath !== data.path) {
      await context.supabase.storage.from(BUCKET).remove([data.previousPath]);
    }
    return { ok: true, id: context.userId };
  });
