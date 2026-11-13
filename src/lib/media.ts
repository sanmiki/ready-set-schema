// Storage layout for the private media bucket.
//
// products/<user id>/<product id>/<file>   — listing photos
// avatars/<user id>/<file>                 — profile pictures
//
// The folder name that carries the user id is what the storage policies check,
// so a seller can only ever write inside their own folders.

export const BUCKET = "rewear-media";

const EXTENSION = /\.[a-z0-9]{1,5}$/i;

function safeExtension(fileName: string): string {
  const match = EXTENSION.exec(fileName);
  const ext = match ? match[0].slice(1).toLowerCase() : "jpg";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

function token(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function productImagePath(userId: string, productId: string, index: number, file: File): string {
  return `products/${userId}/${productId}/${index}-${token()}.${safeExtension(file.name)}`;
}

export function avatarPath(userId: string, file: File): string {
  return `avatars/${userId}/${token()}.${safeExtension(file.name)}`;
}

export const MAX_PHOTOS = 8;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function validatePhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) return "მხოლოდ სურათებია შესაძლებელი.";
  if (file.size > MAX_FILE_BYTES) return "ერთი ფოტო 10 მბ-ზე მეტი ვერ იქნება.";
  return null;
}
