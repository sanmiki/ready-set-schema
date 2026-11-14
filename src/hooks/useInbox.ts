import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "./useSession";
import { getInbox } from "@/lib/messaging.functions";

export function useInbox() {
  const { user } = useSession();
  const fetchInbox = useServerFn(getInbox);
  return useQuery({ queryKey: ["messaging", "inbox", user?.id], queryFn: () => fetchInbox(), enabled: !!user });
}