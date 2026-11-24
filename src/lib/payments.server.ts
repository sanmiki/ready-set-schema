import { fetchFlittStatus, verifyFlittPayload, type VerifiedFlittOrder } from "./flitt.server";
import type { FlittParams } from "./flitt";

type Source = "callback" | "status_check";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function logRejectedEvent(source: Source, outcome: string, details: Record<string, unknown>) {
  const db = await admin();
  await db.from("payment_events").insert({ source, signature_valid: false, outcome, details: details as never });
}

export async function applyVerifiedOrder(order: VerifiedFlittOrder, source: Source): Promise<string> {
  const db = await admin();
  const { data, error } = await db.rpc("complete_payment_order", {
    _payment_id: order.paymentId,
    _order_status: order.orderStatus,
    _amount: order.amount,
    _currency: order.currency,
    _provider_payment_id: order.providerPaymentId as string,
    _source: source,
    _details: order.details as never,
  });
  if (error) {
    console.error("complete_payment_order", error.message);
    throw new Error("complete_failed");
  }
  return data ?? "error";
}

export async function handleFlittPayload(payload: FlittParams, source: Source): Promise<string> {
  const verified = await verifyFlittPayload(payload);
  if (!verified) {
    await logRejectedEvent(source, "invalid_signature", { order_id: String(payload["order_id"] ?? "").slice(0, 64) });
    return "invalid_signature";
  }
  return applyVerifiedOrder(verified, source);
}

// Server-to-server status check: used when the browser returns before the callback arrives.
export async function syncFromFlitt(paymentId: string): Promise<string> {
  const status = await fetchFlittStatus(paymentId);
  if (!status) return "unavailable";
  return handleFlittPayload(status, "status_check");
}
