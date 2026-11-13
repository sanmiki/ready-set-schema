// Georgian labels, option lists and formatting helpers shared by every screen.

export const CONDITIONS = [
  { value: "new", label: "ახალი" },
  { value: "like_new", label: "თითქმის ახალი" },
  { value: "good", label: "კარგი" },
  { value: "fair", label: "ცვეთილი" },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];

export const STATUSES = [
  { value: "draft", label: "გამოუქვეყნებელი" },
  { value: "active", label: "გამოქვეყნებული" },
  { value: "reserved", label: "დაჯავშნული" },
  { value: "sold", label: "გაყიდული" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "ერთი ზომა"] as const;

export const CITIES = [
  "თბილისი",
  "ბათუმი",
  "ქუთაისი",
  "რუსთავი",
  "გორი",
  "ფოთი",
  "ზუგდიდი",
  "თელავი",
  "ახალციხე",
  "სხვა ქალაქი",
] as const;

export const SORTS = [
  { value: "new", label: "ახლები ჯერ" },
  { value: "price_asc", label: "ფასი: იავი → ძვირი" },
  { value: "price_desc", label: "ფასი: ძვირი → იავი" },
] as const;

export type Sort = (typeof SORTS)[number]["value"];

export function conditionLabel(value: string | null | undefined): string {
  return CONDITIONS.find((c) => c.value === value)?.label ?? "";
}

export function statusLabel(value: string | null | undefined): string {
  return STATUSES.find((s) => s.value === value)?.label ?? "";
}

const priceFormatter = new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 0 });

// Listings are priced in georgian lari; whole lari reads best on cards.
export function formatPrice(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${priceFormatter.format(Math.round(n))} ₾`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ka-GE", { day: "numeric", month: "long", year: "numeric" }).format(d);
}
