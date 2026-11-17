import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { listingHasPublicPhone, revealListingPhone } from "@/lib/contact.functions";
import { formatGeorgianPhone, telHref } from "@/lib/phone";

// Phone part of the seller contact box: reveal the opted-in number, then call it.
export function PhoneContact({ productId }: { productId: string }) {
  const { data: hasPhone } = useQuery({
    queryKey: ["listing-has-phone", productId],
    queryFn: () => listingHasPublicPhone({ data: { productId } }),
  });
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!hasPhone) return null;

  if (!phone) {
    return (
      <Button
        variant="outline"
        className="rounded-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const number = await revealListingPhone({ data: { productId } }).catch(() => null);
          setBusy(false);
          if (number) setPhone(number);
          else toast.error("ნომრის ჩვენება ვერ მოხერხდა.");
        }}
      >
        <Phone className="h-4 w-4" />
        {busy ? "იტვირთება…" : "ნომრის ჩვენება"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-lg font-semibold tracking-wide">{formatGeorgianPhone(phone)}</span>
      <Button asChild className="rounded-full">
        <a href={telHref(phone)}>
          <Phone className="h-4 w-4" />
          დარეკვა
        </a>
      </Button>
    </div>
  );
}
