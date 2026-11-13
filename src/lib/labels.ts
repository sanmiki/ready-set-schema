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

// Dates and prices are formatted without Intl: the browser and the server must
// produce byte-identical text, and locale data is not available everywhere.
const MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

// Listings are priced in georgian lari; whole lari reads best on cards.
export function formatPrice(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${grouped} ₾`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}
