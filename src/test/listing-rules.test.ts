import { describe, expect, it } from "vitest";

import { listingFieldsSchema, profileFieldsSchema, signUpSchema } from "@/lib/validation";

const listing = {
  title: "ჯინსის ქურთუკი",
  condition: "good" as const,
  price: "45",
};

describe("Listing rules", () => {
  it("rejects a negative price", () => {
    const result = listingFieldsSchema.safeParse({ ...listing, price: "-5" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("ფასი უარყოფითი ვერ იქნება");
    }
  });

  it("accepts a price of zero", () => {
    expect(listingFieldsSchema.safeParse({ ...listing, price: "0" }).success).toBe(true);
  });

  it("requires a title of at least 3 characters", () => {
    const result = listingFieldsSchema.safeParse({ ...listing, title: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("სათაური მინიმუმ 3 სიმბოლო უნდა იყოს");
    }
  });

  it("rejects a condition the app does not offer", () => {
    const result = listingFieldsSchema.safeParse({ ...listing, condition: "broken" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("აირჩიეთ მდგომარეობა");
    }
  });
});

describe("Account rules", () => {
  it("requires a password of at least 8 characters at signup", () => {
    const result = signUpSchema.safeParse({ email: "nino@example.com", password: "1234567" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს");
    }
  });

  it("keeps usernames to lowercase letters, digits, dots and underscores", () => {
    const result = profileFieldsSchema.safeParse({ username: "Nino" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "მხოლოდ პატარა ასოები, ციფრები, წერტილი და ქვედა ხაზი",
      );
    }
  });
});
