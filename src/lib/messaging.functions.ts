import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conversationInput, messageInput } from "./messaging-rules";

export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("messaging_inbox");
    if (error) throw new Error("მიმოწერის ჩატვირთვა ვერ მოხერხდა.");
    return data ?? [];
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("start_conversation", { _product_id: data.productId });
    if (error || !id) throw new Error("მიმოწერა ვერ გაიხსნა. შეამოწმეთ, რომ ნივთი ხელმისაწვდომია და თქვენ არ გეკუთვნით.");
    return { id };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(conversationInput)
  .handler(async ({ data, context }) => {
    const { data: conversation } = await context.supabase.from("conversations").select("id").eq("id", data.conversationId).maybeSingle();
    if (!conversation) throw new Error("მიმოწერა ვერ მოიძებნა ან წვდომა არ გაქვთ.");
    const { data: messages, error } = await context.supabase.from("messages").select("id,conversation_id,sender_id,content,created_at,read_at").eq("conversation_id", data.conversationId).order("created_at").order("id");
    if (error) throw new Error("შეტყობინებები ვერ ჩაიტვირთა.");
    return messages ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(messageInput)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").insert({ conversation_id: data.conversationId, sender_id: context.userId, content: data.content });
    if (error) throw new Error("შეტყობინება ვერ გაიგზავნა. სცადეთ ხელახლა.");
    return { ok: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(conversationInput)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_conversation_read", { _conversation_id: data.conversationId });
    if (error) throw new Error("წაკითხვის მონიშვნა ვერ მოხერხდა.");
    return { ok: true };
  });