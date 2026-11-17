import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { startConversation } from "@/lib/messaging.functions";

// Internal chat part of the seller contact box.
export function ContactSeller({
  productId,
  isOwner,
  variant = "default",
}: {
  productId: string;
  isOwner: boolean;
  variant?: "default" | "outline";
}) {
  const { user, ready } = useSession();
  const start = useServerFn(startConversation);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (isOwner) return null;

  if (ready && !user) {
    return (
      <Button asChild variant="outline" className="h-11 rounded-full px-6">
        <Link to="/auth" search={{ redirect: `/product/${productId}` }}>
          <MessageCircle className="h-4 w-4" />
          შედით, რომ გამყიდველს მისწეროთ
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      disabled={!ready || busy}
      className="h-11 rounded-full px-6"
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await start({ data: { productId } });
          await navigate({ to: "/messages", search: { conversation: id } });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "მიმოწერა ვერ გაიხსნა.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <MessageCircle className="h-4 w-4" />
      {busy ? "იხსნება…" : "მიწერე გამყიდველს"}
    </Button>
  );
}
