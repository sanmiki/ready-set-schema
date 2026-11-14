import { createFileRoute } from "@tanstack/react-router";

import { publishableClient } from "@/lib/db";
import { BUCKET } from "@/lib/media";

// Listing photos live in a private bucket. Public pages point here instead of at
// a signed URL, so the same picture has the same address on every render; this
// handler checks the row is really public and then hands out a short-lived URL.
const PATH_PATTERN = /^(products|avatars)\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const SIGNED_URL_SECONDS = 300;
const REDIRECT_CACHE_SECONDS = 60;

export const Route = createFileRoute("/api/public/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("p") ?? "";

        if (!PATH_PATTERN.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const client = publishableClient();

        // What counts as public is decided by the same rules the data API
        // applies: a photo of a live listing, or an avatar a profile points at.
        const photo = await client
          .from("product_images")
          .select("product_id, products!inner(status)")
          .eq("storage_path", path)
          .eq("products.status", "active")
          .limit(1);

        if ((photo.data?.length ?? 0) === 0) {
          const avatar = await client
            .from("profiles")
            .select("id")
            .eq("avatar_url", path)
            .limit(1);
          if ((avatar.data?.length ?? 0) === 0) {
            return new Response("Not found", { status: 404 });
          }
        }

        // Public callers cannot sign or list storage directly. Privileged
        // signing is allowed only after the public-data check above succeeds.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_SECONDS);

        if (!data?.signedUrl) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": `private, max-age=${REDIRECT_CACHE_SECONDS}`,
          },
        });
      },
    },
  },
});
