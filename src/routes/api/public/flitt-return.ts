import { createFileRoute } from "@tanstack/react-router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Flitt response_url (browser POST). Only redirects; never changes payment state.
function back(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("pid") ?? "";
  const target = UUID.test(id) ? `/payment/${id}` : "/payments";
  return new Response(null, { status: 303, headers: { Location: new URL(target, url.origin).toString() } });
}

export const Route = createFileRoute("/api/public/flitt-return")({
  server: { handlers: { POST: async ({ request }) => back(request), GET: async ({ request }) => back(request) } },
});
