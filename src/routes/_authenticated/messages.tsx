import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInbox } from "@/hooks/useInbox";
import { useSession } from "@/hooks/useSession";
import { getMessages, markRead, sendMessage } from "@/lib/messaging.functions";
import { messageTime } from "@/lib/messaging-rules";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (raw): { conversation?: string | undefined } => ({ conversation: z.string().uuid().safeParse(raw["conversation"]).success ? String(raw["conversation"]) : undefined }),
  head: () => ({ meta: [
    { title: "შეტყობინებები · MEORADI" },
    { name: "description", content: "პირადი მიმოწერა MEORADI-ის მყიდველებსა და გამყიდველებს შორის." },
    { property: "og:title", content: "შეტყობინებები · MEORADI" },
    { property: "og:description", content: "თქვენი პირადი მიმოწერა MEORADI-ზე." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { conversation } = Route.useSearch();
  const navigate = useNavigate();
  const inbox = useInbox();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fetchMessages = useServerFn(getMessages);
  const send = useServerFn(sendMessage);
  const read = useServerFn(markRead);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const thread = inbox.data?.find((row) => row.id === conversation);
  const messages = useQuery({ queryKey: ["messaging", "messages", user?.id, conversation], queryFn: () => fetchMessages({ data: { conversationId: conversation ?? "" } }), enabled: !!conversation && !!user });
  useEffect(() => { setDraft(""); setReadError(false); }, [conversation]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.data?.length, conversation]);
  const unread = messages.data?.filter((message) => message.sender_id !== user?.id && !message.read_at).length ?? 0;
  useEffect(() => {
    if (!conversation || !unread) return;
    let active = true;
    void read({ data: { conversationId: conversation } }).then(() => {
      if (active) { setReadError(false); void queryClient.invalidateQueries({ queryKey: ["messaging"] }); }
    }).catch(() => { if (active) setReadError(true); });
    return () => { active = false; };
  }, [conversation, unread, read, queryClient]);

  return <div className="container-page py-6 md:py-8">
    <h1 className="mb-6 text-2xl">შეტყობინებები</h1>
    <div className="grid min-w-0 border-y border-border md:h-[650px] md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={`${conversation ? "hidden md:block" : "block"} min-w-0 overflow-y-auto md:border-r md:border-border`}>
        {inbox.isPending && <p className="p-5 text-sm text-muted-foreground">მიმოწერა იტვირთება…</p>}
        {inbox.isError && <div className="p-5"><p role="alert" className="text-sm text-destructive">მიმოწერა ვერ ჩაიტვირთა.</p><Button variant="ghost" onClick={() => void inbox.refetch()}>ხელახლა მცდელობა</Button></div>}
        {inbox.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">მიმოწერა ჯერ არ გაქვთ.</p>}
        {inbox.data?.map((row) => <Button key={row.id} variant="ghost" className={`h-auto w-full justify-start gap-3 rounded-none border-b border-border p-4 text-left ${conversation === row.id ? "bg-sage-soft" : ""}`} onClick={() => void navigate({ to: "/messages", search: { conversation: row.id } })}>
          <span className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">{row.image_path ? <img src={`/api/public/media?p=${encodeURIComponent(row.image_path)}`} alt="" width={44} height={56} className="h-full w-full object-cover" /> : <MessageCircle className="h-5 w-5 text-muted-foreground" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{row.other_name}</span><span className="block truncate text-xs text-muted-foreground">{row.product_title}</span><span className="mt-1 block truncate text-xs">{row.latest_content ?? "ახალი მიმოწერა"}</span></span>
          {Number(row.unread_count) > 0 && <span aria-label={`${row.unread_count} წაუკითხავი`} className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{row.unread_count}</span>}
        </Button>)}
      </aside>
      <section className={`${conversation ? "flex" : "hidden md:flex"} min-w-0 flex-col h-[calc(100dvh-12rem)] min-h-80 md:h-full`}>
        {!conversation ? <div className="flex flex-1 items-center justify-center gap-3 text-sm text-muted-foreground"><MessageCircle className="h-5 w-5" />აირჩიეთ მიმოწერა</div> : <>
          <div className="flex shrink-0 items-center gap-3 border-b border-border p-4"><Button size="icon" variant="ghost" aria-label="მიმოწერის სიაში დაბრუნება" className="md:hidden" onClick={() => void navigate({ to: "/messages", search: {} })}><ArrowLeft className="h-5 w-5" /></Button><div className="min-w-0"><h2 className="truncate text-base">{thread?.other_name ?? "მიმოწერა"}</h2><p className="truncate text-xs text-muted-foreground">{thread?.product_title}</p></div></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-label="შეტყობინებები">
            {messages.isPending && <p className="text-sm text-muted-foreground">შეტყობინებები იტვირთება…</p>}
            {messages.isError && <div role="alert"><p className="text-sm text-destructive">მიმოწერა ვერ ჩაიტვირთა ან წვდომა არ გაქვთ.</p><Button variant="ghost" onClick={() => void messages.refetch()}>ხელახლა მცდელობა</Button></div>}
            {messages.data?.length === 0 && <p className="text-center text-sm text-muted-foreground">შეტყობინებები ჯერ არ არის.</p>}
            {messages.data?.map((message) => <div key={message.id} className={`flex ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-lg px-4 py-3 ${message.sender_id === user?.id ? "bg-sage-soft" : "bg-muted"}`}><p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.content}</p><p className="mt-1 text-[10px] text-muted-foreground">{messageTime(message.created_at)}{message.sender_id === user?.id && message.read_at ? " · წაკითხულია" : ""}</p></div></div>)}
            <div ref={end} />
          </div>
          {readError && <p role="alert" className="px-4 text-xs text-destructive">წაკითხვის მონიშვნა ვერ მოხერხდა.</p>}
          <form className="flex shrink-0 items-end gap-2 border-t border-border p-4" onSubmit={async (event) => {
            event.preventDefault(); if (!draft.trim() || busy) return;
            const id = conversation;
            setBusy(true);
            try { await send({ data: { conversationId: id, content: draft } }); setDraft(""); await queryClient.invalidateQueries({ queryKey: ["messaging"] }); toast.success("შეტყობინება გაიგზავნა"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "შეტყობინება ვერ გაიგზავნა."); }
            finally { setBusy(false); }
          }}>
            <Textarea aria-label="შეტყობინების ტექსტი" placeholder="შეტყობინება…" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy || messages.isError || !thread} className="max-h-32 min-h-12 resize-none" />
            <Button type="submit" size="icon" aria-label="შეტყობინების გაგზავნა" title="შეტყობინების გაგზავნა" disabled={busy || !draft.trim() || messages.isError || !thread}><Send className="h-4 w-4" /></Button>
          </form>
        </>}
      </section>
    </div>
  </div>;
}