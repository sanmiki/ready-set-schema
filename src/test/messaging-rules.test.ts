import { describe, expect, it } from "vitest";
import { messageInput } from "@/lib/messaging-rules";

const conversationId = "11111111-1111-4111-8111-111111111111";
describe("Messaging validation", () => {
  it("rejects empty messages", () => {
    expect(messageInput.safeParse({ conversationId, content: "   " }).success).toBe(false);
  });
  it("accepts 2000 characters and rejects 2001", () => {
    expect(messageInput.safeParse({ conversationId, content: "ა".repeat(2000) }).success).toBe(true);
    expect(messageInput.safeParse({ conversationId, content: "ა".repeat(2001) }).success).toBe(false);
  });
  it("does not trust client sender IDs", () => {
    expect(messageInput.parse({ conversationId, content: "გამარჯობა", senderId: "attacker" })).toEqual({ conversationId, content: "გამარჯობა" });
  });
});