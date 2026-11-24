export const CURRENT_LEGAL_VERSION = "2026-11-24-draft-1";

export type LegalContext = "registration" | "listing" | "promotion";
export type LegalDocumentKey = "terms" | "privacy" | "listing_rules" | "refund_policy";

export const LEGAL_CONSENT_REQUIRED =
  "გადახდამდე დაგვიდასტურეთ, რომ ეთანხმებით მომსახურების წესებსა და თანხის დაბრუნების პოლიტიკას.";

export function legalDocumentsForContext(context: LegalContext): LegalDocumentKey[] {
  if (context === "registration") return ["terms", "privacy", "listing_rules"];
  if (context === "listing") return ["terms", "listing_rules", "refund_policy"];
  return ["terms", "refund_policy"];
}

export function paidServiceConsentError(amountTetri: number, accepted: boolean): string | null {
  return amountTetri > 0 && !accepted ? LEGAL_CONSENT_REQUIRED : null;
}
