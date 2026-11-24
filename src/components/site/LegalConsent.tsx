import { Link } from "@tanstack/react-router";

import { formatTetri } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type ConsentKind = "registration" | "listing" | "promotion";

export function LegalConsent({
  id,
  checked,
  onChange,
  kind,
  amountTetri,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  kind: ConsentKind;
  amountTetri?: number;
  disabled?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-background p-4", disabled && "opacity-60")}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          required
        />
        <div className="min-w-0 text-sm leading-6">
          <label htmlFor={id} className="cursor-pointer font-medium">
            {kind === "registration"
              ? "ვეთანხმები MEORADI-ს მონახაზ დოკუმენტებს:"
              : "დავადასტურებ ამ ფასიანი სერვისის შეძენას და ვეთანხმები:"}
          </label>
          <span className="ml-1 inline-flex flex-wrap gap-x-2 gap-y-1 text-primary">
            <Link to="/terms" target="_blank" className="underline-offset-4 hover:underline">მომსახურების წესები</Link>
            {kind !== "promotion" && <Link to="/listing-rules" target="_blank" className="underline-offset-4 hover:underline">განცხადებების წესები</Link>}
            {kind === "registration" ? (
              <Link to="/privacy" target="_blank" className="underline-offset-4 hover:underline">კონფიდენციალურობის პოლიტიკა</Link>
            ) : (
              <Link to="/refunds" target="_blank" className="underline-offset-4 hover:underline">თანხის დაბრუნების პოლიტიკა</Link>
            )}
          </span>
          {kind === "registration" && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              გავეცანი, რომ აქტიურ განცხადებაზე მითითებული საკონტაქტო ტელეფონის ნომერი საჯაროდ გამოჩნდება.
            </p>
          )}
          {kind !== "registration" && amountTetri != null && (
            <p className="mt-2 text-xs text-muted-foreground">გადასახდელი ჯამი: <strong className="text-foreground">{formatTetri(amountTetri)}</strong></p>
          )}
        </div>
      </div>
    </div>
  );
}
