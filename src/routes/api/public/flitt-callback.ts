import { createFileRoute } from "@tanstack/react-router";

// Flitt server_callback_url. Trust comes only from the signature check below.
export const Route = createFileRoute("/api/public/flitt-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 20000) return new Response("too large", { status: 413 });
        let payload: Record<string, unknown> = {};
        try {
          const ct = request.headers.get("content-type") ?? "";
          if (ct.includes("json")) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            payload = (parsed["response"] as Record<string, unknown>) ?? parsed;
          } else {
            payload = Object.fromEntries(new URLSearchParams(raw));
          }
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const { handleFlittPayload } = await import("@/lib/payments.server");
        try {
          const result = await handleFlittPayload(payload, "callback");
          if (result === "invalid_signature") return new Response("invalid signature", { status: 401 });
          return new Response("OK");
        } catch {
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
