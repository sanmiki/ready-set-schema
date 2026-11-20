export const REPORT_REASONS = [
  { value: "suspicious", label: "საეჭვო განცხადება" },
  { value: "prohibited", label: "აკრძალული ნივთი" },
  { value: "misleading", label: "შეცდომაში შემყვანი აღწერა" },
  { value: "fraud", label: "თაღლითური ქცევა" },
  { value: "inappropriate", label: "შეუსაბამო კონტენტი" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

export const REPORT_STATUS: Record<string, string> = {
  new: "ახალი", under_review: "განხილვაში", resolved: "გადაწყვეტილი", dismissed: "უარყოფილი",
};
export const LISTING_STATUS: Record<string, string> = {
  active: "აქტიური", draft: "მონახაზი", reserved: "დაჯავშნილი", sold: "გაყიდული",
};
export const LEDGER_KIND: Record<string, string> = {
  topup: "შევსება", listing_charge: "განცხადების საფასური", promotion_charge: "პრომო სერვისი", refund: "დაბრუნება",
};
export const PAYMENT_STATUS: Record<string, string> = {
  pending: "მოლოდინში", paid: "დადასტურებული", failed: "წარუმატებელი", canceled: "გაუქმებული",
};
export const AUDIT_ACTION: Record<string, string> = {
  "user.suspend": "ანგარიშის შეჩერება", "user.unsuspend": "შეჩერების მოხსნა",
  "listing.hide": "განცხადების დამალვა", "listing.prohibit": "აკრძალულად მონიშვნა", "listing.restore": "განცხადების აღდგენა",
  "report.update": "საჩივრის განახლება", "settings.update": "პარამეტრების ცვლილება",
};
export const TIER_NAME: Record<string, string> = { vip: "VIP", vip_plus: "VIP+", super_vip: "SUPER VIP" };

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ka-GE", { year: "numeric", month: "short", day: "numeric" });
}
