import { describe, expect, it } from "vitest";
import { formatGeorgianPhone, normalizeGeorgianPhone, telHref } from "@/lib/phone";

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
