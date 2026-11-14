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
