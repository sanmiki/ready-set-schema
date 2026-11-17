// Listing fee rules. The database function publish_listing is the authority;
// these helpers only describe the same rules for display.
export const LISTING_FEE_TETRI = 50;
export const TOPUP_CHOICES_TETRI = [200, 500, 1000] as const;

export function feeForNextListing(publishedBefore: number): number {
  return publishedBefore > 0 ? LISTING_FEE_TETRI : 0;
}

export function canPayFromBalance(balanceTetri: number, feeTetri: number): boolean {
  return balanceTetri >= feeTetri;
}

export function formatTetri(tetri: number): string {
  return `${(tetri / 100).toFixed(2)} ₾`;
}
