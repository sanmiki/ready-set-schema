import { describe, expect, it } from "vitest";

import { legalDocumentsForContext, paidServiceConsentError } from "@/lib/legal";

describe("legal consent", () => {
  it("does not require paid-service consent for a free first listing", () => {
    expect(paidServiceConsentError(0, false)).toBeNull();
  });

  it("requires consent before a 0.50 ₾ listing charge", () => {
    expect(paidServiceConsentError(50, false)).not.toBeNull();
  });

  it("allows a paid service after consent", () => {
    expect(paidServiceConsentError(50, true)).toBeNull();
  });

  it("records terms, privacy and listing rules at registration", () => {
    expect(legalDocumentsForContext("registration")).toEqual(["terms", "privacy", "listing_rules"]);
  });

  it("records refund terms for promotion purchases", () => {
    expect(legalDocumentsForContext("promotion")).toEqual(["terms", "refund_policy"]);
  });
});
