// Client-safe promotion catalogue. Prices shown here come from the server;
// the database recalculates every total before charging.
export type TierCode = "vip" | "vip_plus" | "super_vip";
export type BumpMode = "none" | "once" | "daily";
export type PriceCode = TierCode | "highlight" | "bump";
export type PromotionPrices = Record<PriceCode, number>;

export const DURATIONS = [1, 3, 7] as const;
export type Duration = (typeof DURATIONS)[number];

export const TIERS: { code: TierCode; name: string; rank: 1 | 2 | 3; benefits: string[] }[] = [
  { code: "vip", name: "VIP", rank: 1, benefits: ["VIP ნიშანი განცხადებაზე", "უფრო მაღლა საკუთარ კატეგორიაში"] },
  { code: "vip_plus", name: "VIP+", rank: 2, benefits: ["VIP-ის ყველა უპირატესობა", "VIP-ზე მაღლა კატალოგის რჩეულ ადგილებში"] },
  { code: "super_vip", name: "SUPER VIP", rank: 3, benefits: ["VIP+-ის ყველა უპირატესობა", "მთავარ გვერდზე რეკლამის სექციაში მოხვედრის შესაძლებლობა"] },
];

export const TIER_LABEL: Record<number, string> = { 1: "VIP", 2: "VIP+", 3: "SUPER VIP" };

export type PromotionChoice = { tier: TierCode | null; days: Duration; highlight: boolean; bump: BumpMode };

export type QuoteLine = { label: string; detail: string; tetri: number };

export function bumpRuns(bump: BumpMode, days: Duration): number {
  return bump === "daily" ? days : bump === "once" ? 1 : 0;
}

export function quoteLines(prices: PromotionPrices, choice: PromotionChoice): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const dayWord = `${choice.days} დღე`;
  if (choice.tier) {
    const tier = TIERS.find((t) => t.code === choice.tier)!;
    lines.push({ label: tier.name, detail: `${dayWord} × ${fmt(prices[choice.tier])}`, tetri: prices[choice.tier] * choice.days });
  }
  if (choice.highlight) {
    lines.push({ label: "გამორჩევა", detail: `${dayWord} × ${fmt(prices.highlight)}`, tetri: prices.highlight * choice.days });
  }
  const runs = bumpRuns(choice.bump, choice.days);
  if (runs > 0) {
    lines.push({ label: "ავტომატური აწევა", detail: `${runs} × ${fmt(prices.bump)}`, tetri: prices.bump * runs });
  }
  return lines;
}

export function quoteTotal(prices: PromotionPrices, choice: PromotionChoice): number {
  return quoteLines(prices, choice).reduce((sum, line) => sum + line.tetri, 0);
}

function fmt(tetri: number) {
  return `${(tetri / 100).toFixed(2)} ₾`;
}
