import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export function MessagingLive() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["messaging"] }); };
    const channel = supabase.channel(`messaging-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${user.id}` }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    // Refetch as a fallback during temporary connection interruptions.
    const interval = window.setInterval(refresh, 15000);
    return () => { window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);
  return null;
}