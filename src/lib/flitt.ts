// Flitt signature rules (https://docs.flitt.com/api/building-signature/):
// sha1(secret | non-empty values sorted by key name), lowercase hex.
// `signature` and `response_signature_string` are never part of the string.
export type FlittParams = Record<string, unknown>;

export function flittSignatureString(secret: string, params: FlittParams): string {
  const values = Object.keys(params)
    .filter((k) => k !== "signature" && k !== "response_signature_string")
    .sort()
    .map((k) => params[k])
    .filter((v) => v !== null && v !== undefined && String(v) !== "")
    .map((v) => String(v));
  return [secret, ...values].join("|");
}

export async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function flittSign(secret: string, params: FlittParams): Promise<string> {
  return sha1Hex(flittSignatureString(secret, params));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyFlittSignature(secret: string, params: FlittParams): Promise<boolean> {
  const given = typeof params["signature"] === "string" ? (params["signature"] as string).toLowerCase() : "";
  if (!/^[0-9a-f]{40}$/.test(given)) return false;
  return safeEqual(await flittSign(secret, params), given);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
