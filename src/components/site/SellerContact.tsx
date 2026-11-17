import { useState } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { revealListingPhone } from "@/lib/contact.functions";
import { formatGeorgianPhone, telHref } from "@/lib/phone";

// One button: reveal the opted-in number, then the same button dials it.
export function PhoneContact({
  productId,
  hasPhone,
}: {
  productId: string;
  hasPhone: boolean;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasPhone) return null;

  if (phone) {
    const label = `${formatGeorgianPhone(phone)} · დარეკვა`;
    return (
      <Button asChild size="lg" className="h-11 rounded-full px-6 shadow-card">
        <a href={telHref(phone)}>
          <Phone className="h-4 w-4" />
          <span className="tabular-nums">{label}</span>
        </a>
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="h-11 rounded-full px-6 shadow-card"
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
