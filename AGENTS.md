<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Messaging uses authenticated server functions, participant-only RLS, and narrowly granted database functions for conversation creation, safe counterpart summaries and read receipts; clients cannot mutate conversation ownership or message metadata.
- One root-mounted messaging subscription invalidates user-keyed queries on permitted realtime changes; periodic refetch recovers missed events without duplicate per-screen subscriptions.

- Public pages load photos through the same-origin `/api/public/media` route,
  which checks the listing is live and then 302s to a short-lived signed URL.
  Storage reads are owner-only; this route verifies public visibility with a publishable client before loading the privileged signer, and product checks must use an inner join so hidden listings cannot qualify.
  Signed URLs embed the signing timestamp, so handing them to the browser
  directly makes the server and client render different strings and the page
  hydration-mismatches.
- Seller-only surfaces (my items, the edit form) keep signed URLs from the
  owner's own session, because drafts and reserved items must not be reachable
  through the public media route.
- A sibling page that shares a URL prefix with another page needs a trailing
  underscore in its filename (`sell_.$id.tsx`, not `sell.$id.tsx`); the dot
  form nests it inside the other page, which has no `<Outlet />` and so never
  shows it.
- Never seed demo listings or fake purchase states. The shop shows only real
  rows, and an empty shop shows a Georgian empty state.
- Listing phone numbers live in owner-only `listing_contacts` (per-listing `is_public`), private defaults in `seller_contacts`; the public reads them only via security-definer RPCs that require opt-in and a live listing, so phones never leak through product/profile selects.
- Listing publication goes only through the security-definer publish_listing RPC (trigger blocks non-draft status without a listing_publications row); wallet ledger is append-only integer tetri — so pricing can't be bypassed via the API.
- Promotions are bought only through the security-definer purchase_promotion RPC, which recomputes the price from promotion_prices and debits the wallet ledger atomically; ranking reads promoted_listings(), which computes a separate rank time and ignores expired promotions and non-live listings — so clients can't grant themselves placement and created_at is never rewritten.
- Admin access: roles live only in `user_roles` (no self-grant policy); every admin read/write goes through SECURITY DEFINER `admin_*` RPCs that call `require_admin()` and write `admin_audit_log` (append-only) — so the /admin route gate is UX only and the database is the boundary.
- Moderation/suspension live in admin-only tables (`listing_moderation`, `account_suspensions`), never on user-editable rows; `guard_listing_status` and `publish_listing` refuse to re-activate moderated listings, and listing fee/first-free come from `platform_settings` — so sellers can't undo moderation or pricing via the API.
- Audience (men/women/kids/unisex) lives only in `products.audience`; audience-root categories stay in the table for legacy rows but are hidden from category dropdowns and rejected as a listing category, and catalog `?category=<audience>` maps to the audience filter — so old links and listings keep working.
