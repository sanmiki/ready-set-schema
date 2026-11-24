import { flittSign, verifyFlittSignature, UUID_RE, type FlittParams } from "./flitt";

const API = "https://pay.flitt.com/api";

export function flittConfig() {
  const merchantId = process.env["FLITT_MERCHANT_ID"];
  const secret = process.env["FLITT_SECRET_KEY"];
  const environment = process.env["FLITT_ENVIRONMENT"] === "live" ? "live" : "sandbox";
  if (!merchantId || !secret) throw new Error("flitt not configured");
  return { merchantId, secret, environment } as const;
}

export async function createFlittCheckout(input: {
  orderId: string; amountTetri: number; description: string; responseUrl: string; callbackUrl: string;
}): Promise<string> {
  const { merchantId, secret } = flittConfig();
  const request: FlittParams = {
    order_id: input.orderId,
    merchant_id: merchantId,
    order_desc: input.description,
    amount: input.amountTetri,
    currency: "GEL",
    response_url: input.responseUrl,
    server_callback_url: input.callbackUrl,
    lifetime: 1800,
    lang: "ka",
  };
  request["signature"] = await flittSign(secret, request);
  const res = await fetch(`${API}/checkout/url`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request }),
  });
  const body = (await res.json().catch(() => null)) as { response?: Record<string, unknown> } | null;
  const url = body?.response?.["checkout_url"];
  if (typeof url !== "string" || !url.startsWith("https://pay.flitt.com/")) {
    console.error("flitt checkout failed", body?.response?.["error_code"], body?.response?.["error_message"]);
    throw new Error("checkout_failed");
  }
  return url;
}

export type VerifiedFlittOrder = {
  paymentId: string; orderStatus: string; amount: number; currency: string; providerPaymentId: string | null;
  details: Record<string, unknown>;
};

// Validates signature + merchant on any Flitt response/callback payload.
export async function verifyFlittPayload(p: FlittParams): Promise<VerifiedFlittOrder | null> {
  const { merchantId, secret } = flittConfig();
  if (!(await verifyFlittSignature(secret, p))) return null;
  if (String(p["merchant_id"] ?? "") !== merchantId) return null;
  const orderId = String(p["order_id"] ?? "");
  if (!UUID_RE.test(orderId)) return null;
  const amount = Number(p["amount"]);
  if (!Number.isInteger(amount)) return null;
  return {
    paymentId: orderId,
    orderStatus: String(p["order_status"] ?? ""),
    amount,
    currency: String(p["currency"] ?? ""),
    providerPaymentId: p["payment_id"] != null && p["payment_id"] !== "" ? String(p["payment_id"]) : null,
    // Safe subset only — no card data, tokens or emails.
    details: {
      order_status: p["order_status"], response_status: p["response_status"], tran_type: p["tran_type"],
      response_code: p["response_code"], payment_id: p["payment_id"], amount: p["amount"], currency: p["currency"],
    },
  };
}

export async function fetchFlittStatus(orderId: string): Promise<FlittParams | null> {
  const { merchantId, secret } = flittConfig();
  const request: FlittParams = { order_id: orderId, merchant_id: merchantId, version: "1.0.1" };
  request["signature"] = await flittSign(secret, request);
  const res = await fetch(`${API}/status/order_id`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request }),
  });
  const body = (await res.json().catch(() => null)) as { response?: FlittParams } | null;
  if (!body?.response || body.response["response_status"] !== "success") return null;
  return body.response;
}
