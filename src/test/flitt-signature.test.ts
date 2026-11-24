import { describe, expect, it } from "vitest";
import { flittSign, flittSignatureString, verifyFlittSignature } from "@/lib/flitt";

const doc = { server_callback_url: "http://myshop/callback/", order_id: "TestOrder2", currency: "GEL", merchant_id: 1549901, order_desc: "Test payment", amount: 1000 };

describe("flitt signature", () => {
  it("matches the official documented string and signature", async () => {
    expect(flittSignatureString("test", doc)).toBe("test|1000|GEL|1549901|Test payment|TestOrder2|http://myshop/callback/");
    expect(await flittSign("test", doc)).toBe("cd0edb710cbbdb6c2a4d965cdb91fdfabc343215");
  });
  it("skips empty values but keeps zero", () => {
    expect(flittSignatureString("s", { a: "", b: 0, c: null })).toBe("s|0");
  });
  it("rejects a tampered amount", async () => {
    const signed = { ...doc, signature: await flittSign("test", doc) };
    expect(await verifyFlittSignature("test", signed)).toBe(true);
    expect(await verifyFlittSignature("test", { ...signed, amount: 1 })).toBe(false);
    expect(await verifyFlittSignature("wrong", signed)).toBe(false);
  });
});
