export const PAY_STATUS_KA: Record<string, string> = {
  pending: "მუშავდება", paid: "გადახდილი", failed: "წარუმატებელი", canceled: "გაუქმებული",
};
export const PAY_SERVICE_KA: Record<string, string> = { listing: "ფასიანი გამოქვეყნება", promotion: "პრომო სერვისი" };
export const REFUND_KA: Record<string, string> = { none: "—", requested: "მოთხოვნილი", partial: "ნაწილობრივ", refunded: "დაბრუნებული" };
export const isActivated = (r: string | null) => r === "published" || r === "purchased";
