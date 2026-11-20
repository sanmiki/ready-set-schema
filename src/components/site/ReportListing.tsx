import { useNavigate } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/useSession";
import { submitReport } from "@/lib/admin.functions";
import { REPORT_REASONS, type ReportReason } from "@/lib/admin-labels";

export function ReportListing({ productId, isOwner }: { productId: string; isOwner: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (isOwner) return null;

  async function send() {
    if (!reason) return;
    setBusy(true);
    const r = await submitReport({ data: { productId, userId: null, reason, details } }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { toast.error(r?.message ?? "გაგზავნა ვერ მოხერხდა."); return; }
    toast.success("შეტყობინება გაიგზავნა. გმადლობთ!");
    setOpen(false); setReason(null); setDetails("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (user ? setOpen(true) : navigate({ to: "/auth" }))}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> დარღვევის შეტყობინება
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>დარღვევის შეტყობინება</DialogTitle>
            <DialogDescription>შეტყობინებას მხოლოდ MEORADI-ის ადმინისტრაცია ნახავს.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-sage has-[:checked]:border-primary">
                <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[var(--color-primary)]" />
                {r.label}
              </label>
            ))}
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="დეტალები (არასავალდებულო)"
              className="h-24 w-full rounded-xl border border-input bg-card p-3 text-sm outline-none focus-visible:border-primary" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>გაუქმება</Button>
            <Button disabled={!reason || busy} onClick={() => void send()} className="rounded-full">გაგზავნა</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
