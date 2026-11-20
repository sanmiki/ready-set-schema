import { describe, expect, it } from "vitest";
import { LISTING_CATEGORIES, isListingCategorySlug, searchCategories } from "@/lib/listing-categories";

const first = (q: string) => { const r = searchCategories(q); return (r.matches[0] ?? r.suggestions[0])?.name; };

describe("listing categories", () => {
  it("has exactly the 18 categories and no audiences", () => {
    expect(LISTING_CATEGORIES).toHaveLength(18);
    expect(LISTING_CATEGORIES[0].name).toBe("ჰუდები");
    expect(LISTING_CATEGORIES[17].name).toBe("ხალათები");
    for (const a of ["კაცი", "ქალი", "ბავშვი", "უნისექსი"]) expect(LISTING_CATEGORIES.some((c) => c.name === a)).toBe(false);
    expect(isListingCategorySlug("jackets")).toBe(false);
    expect(isListingCategorySlug("men")).toBe(false);
  });
  it("matches singular forms and partial words", () => {
    expect(first("ჰუდი")).toBe("ჰუდები");
    expect(first("ჯინსი")).toBe("ჯინსები");
    expect(first("პერანგი")).toBe("პერანგები");
    expect(first("  შორტი ")).toBe("შორტები");
    expect(searchCategories("კაბა").matches[0]?.name).toBe("კაბები");
    expect(searchCategories("ჯინ").matches[0]?.name).toBe("ჯინსები");
  });
  it("suggests close spellings without matching", () => {
    const r = searchCategories("ჯინსბეი");
    expect(r.matches).toHaveLength(0);
    expect(r.suggestions[0]?.name).toBe("ჯინსები");
  });
  it("returns nothing for unrelated text", () => {
    const r = searchCategories("ტელევიზორი");
    expect(r.matches).toHaveLength(0);
    expect(r.suggestions).toHaveLength(0);
  });
});
