import { z } from "zod";

export const conversationInput = z.object({ conversationId: z.string().uuid() });
export const messageInput = conversationInput.extend({
  content: z.string().trim().min(1, "შეიყვანეთ შეტყობინება.").max(2000, "მაქსიმუმ 2000 სიმბოლო."),
});

export function messageTime(value: string) {
  const date = new Date(value);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()} · ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}