import { describe, expect, it } from "vitest";
import { contactPhoneError, formatGeorgianPhone, normalizeGeorgianPhone, PHONE_ERROR, PHONE_REQUIRED, telHref, visibleContactPhone } from "@/lib/phone";

describe("Georgian phone numbers", () => {
  it("normalizes local mobile numbers to E.164", () => {
    expect(normalizeGeorgianPhone("555 12 34 56")).toBe("+995555123456");
  });
  it("accepts numbers with the +995 prefix", () => {
    expect(normalizeGeorgianPhone("+995 (555) 12-34-56")).toBe("+995555123456");
  });
  it("rejects too short or foreign numbers", () => {
    expect(normalizeGeorgianPhone("55512")).toBeNull();
    expect(normalizeGeorgianPhone("+1 202 555 0100")).toBeNull();
  });
  it("builds a tel: link from the normalized number", () => {
    expect(telHref("+995555123456")).toBe("tel:+995555123456");
    expect(formatGeorgianPhone("+995555123456")).toBe("+995 555 12 34 56");
  });
});

describe("Automatic public listing contact", () => {
  it("shows an active listing's valid contact number without a visibility opt-in", () => {
    expect(visibleContactPhone("555 12 34 56", "active")).toBe("+995555123456");
  });
  it("does not expose a number on a non-active listing", () => {
    expect(visibleContactPhone("+995555123456", "reserved")).toBeNull();
  });
  it("keeps an older active listing without a number accessible without inventing one", () => {
    expect(visibleContactPhone(null, "active")).toBeNull();
  });
});

describe("Listing contact requirement", () => {
  it("requires a contact number when publishing", () => {
    expect(contactPhoneError("", true)).toBe(PHONE_REQUIRED);
    expect(PHONE_REQUIRED).toBe("მიუთითე საკონტაქტო ნომერი");
  });
  it("allows a draft to be saved without a contact number", () => {
    expect(contactPhoneError("", false)).toBeNull();
  });
  it("shows the requested error for an invalid number", () => {
    expect(contactPhoneError("123", true)).toBe(PHONE_ERROR);
    expect(PHONE_ERROR).toBe("შეიყვანე სწორი ტელეფონის ნომერი");
  });
  it("accepts a formatted nine-digit Georgian number when publishing", () => {
    expect(contactPhoneError("555 12 34 56", true)).toBeNull();
  });
});

import { whatsappHref } from "@/lib/phone";
describe("whatsapp link", () => {
  it("uses digits-only number and encoded message with title and url", () => {
    const href = whatsappHref("+995555123456", "ქურთუკი", "https://x.ge/product/1");
    expect(href.startsWith("https://wa.me/995555123456?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1] ?? "")).toBe(
      "გამარჯობა, MEORADI-ზე თქვენი განცხადება ვნახე და მაინტერესებს ეს ნივთი: ქურთუკი https://x.ge/product/1",
    );
  });
});
