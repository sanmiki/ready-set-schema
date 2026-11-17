// Georgian phone numbers: 9 national digits, stored as E.164 (+995XXXXXXXXX).
export function normalizeGeorgianPhone(input: string): string | null {
  let digits = input.trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("995")) digits = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[2-9]\d{8}$/.test(digits)) return null;
  return `+995${digits}`;
}

export function formatGeorgianPhone(e164: string): string {
  const n = e164.replace(/^\+995/, "");
  return `+995 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

export function telHref(e164: string): string {
  return `tel:${e164}`;
}

export const PHONE_ERROR = "ტელეფონის ნომერი არასწორია. მაგ.: 555 12 34 56";

// wa.me wants digits only, e.g. 995555123456.
export function whatsappHref(e164: string, title: string, url: string): string {
  const digits = e164.replace(/\D/g, "");
  const text = `გამარჯობა, ReWear-ზე თქვენი განცხადება ვნახე და მაინტერესებს ეს ნივთი: ${title} ${url}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
