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
