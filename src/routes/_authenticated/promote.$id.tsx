import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LegalConsent } from "@/components/site/LegalConsent";
import { getPromoteCheckout, purchasePromotion } from "@/lib/promotions.functions";
import { paidServiceConsentError } from "@/lib/legal";
import {
  DURATIONS,
  quoteLines,
  quoteTotal,
  TIERS,
  type BumpMode,
  type Duration,
  type TierCode,
} from "@/lib/promotions";
import { formatTetri } from "@/lib/pricing";

const checkoutQuery = (id: string) =>
  queryOptions({ queryKey: ["promote-checkout", id], queryFn: () => getPromoteCheckout({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/promote/$id")({
  head: () => ({
    meta: [
      { title: "პრომო სერვისი · MEORADI" },
      { name: "description", content: "აირჩიეთ VIP, გამორჩევა ან ავტომატური აწევა თქვენი განცხადებისთვის." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "პრომო სერვისი · MEORADI" },
      { property: "og:description", content: "დაწინაურებული განცხადებები MEORADI-ზე." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(checkoutQuery(params.id)),
  errorComponent: () => (
    <div className="container-page py-16 text-center text-sm text-muted-foreground">
      პრომო სერვისის ჩატვირთვა ვერ მოხერხდა. განაახლეთ გვერდი.
    </div>
  ),
  component: PromotePage,
});

const ease = "transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none";
const optionBase = `rounded-2xl border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${ease}`;

function PromotePage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(checkoutQuery(id));
  const queryClient = useQueryClient();

  const [tier, setTier] = useState<TierCode | null>(null);
  const [days, setDays] = useState<Duration>(3);
  const [highlight, setHighlight] = useState(false);
  const [bump, setBump] = useState<BumpMode>("none");
  const [busy, setBusy] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());

  const choice = { tier, days, highlight, bump };
  const lines = useMemo(() => quoteLines(data.prices, choice), [data.prices, tier, days, highlight, bump]);
  const total = quoteTotal(data.prices, choice);
  const enough = data.balance >= total;

  if (!data.listing) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl">ნივთი ვერ მოიძებნა</h1>
        <p className="mt-2 text-sm text-muted-foreground">პრომო მხოლოდ თქვენს ნივთზეა შესაძლებელი.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/my-items">ჩემი ნივთები</Link></Button>
      </div>
    );
  }
  const live = data.listing.status === "active";

  async function pay() {
    if (total === 0 || !enough || !live) return;
    const consentError = paidServiceConsentError(total, legalAccepted);
    if (consentError) {
      toast.error(consentError);
      return;
    }
    setBusy(true);
    try {
      const result = await purchasePromotion({ data: { productId: id, tier, days, highlight, bump, key, legalConsent: { accepted: legalAccepted, key } } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("პრომო სერვისი გააქტიურდა");
      setKey(crypto.randomUUID());
      await queryClient.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page pb-32 pt-10 lg:pb-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">პრომო სერვისი</p>
      <h1 className="mt-2 text-3xl">{data.listing.title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        არასავალდებულოა. დაწინაურებული განცხადებები მოინიშნება როგორც რეკლამა. ნახვებს, გაყიდვას ან ზუსტ პოზიციას ვერ გპირდებით.
      </p>
      {!live && (
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm">პრომო ხელმისაწვდომია მხოლოდ გამოქვეყნებული ნივთისთვის.</p>
      )}
      {data.active.length > 0 && (
        <p className="mt-4 text-sm text-sage-deep">
          აქტიური პრომო: {data.active.map((a) => TIERS.find((t) => t.code === a.tier)?.name ?? (a.highlight ? "გამორჩევა" : "აწევა")).join(", ")} — სრულდება{" "}
          {new Date(data.active[0]!.ends_at).toLocaleDateString("ka-GE")}
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-10">
          <section aria-labelledby="pkg">
            <h2 id="pkg" className="font-sans text-base font-semibold">პაკეტი</h2>
            <div role="radiogroup" aria-labelledby="pkg" className="mt-4 grid gap-3 md:grid-cols-3">
              {TIERS.map((t) => {
                const selected = tier === t.code;
                return (
                  <button
                    key={t.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTier(t.code)}
                    className={`${optionBase} flex h-full flex-col p-5 ${selected ? "border-foreground shadow-card" : "border-border hover:border-sage"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em]">{t.name}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                        {selected && <Check className="h-3 w-3" aria-hidden />}
                      </span>
                    </span>
                    <span className="mt-5 text-3xl font-semibold tracking-tight">{(data.prices[t.code] / 100).toFixed(2)} ₾</span>
                    <span className="text-xs text-muted-foreground">დღეში</span>
                    <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
                      {t.benefits.map((b) => <li key={b}>— {b}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              role="radio"
              aria-checked={tier === null}
              onClick={() => setTier(null)}
              className={`${optionBase} mt-3 flex w-full items-center justify-between px-5 py-4 text-sm ${tier === null ? "border-foreground" : "border-border hover:border-sage"}`}
            >
              <span><span className="font-medium">პრომოს გარეშე</span> <span className="text-muted-foreground">— განცხადება ჩვეულებრივად გამოჩნდება</span></span>
              <span className={`h-5 w-5 shrink-0 rounded-full border ${tier === null ? "border-[6px] border-foreground" : "border-border"}`} aria-hidden />
            </button>
          </section>

          <section aria-labelledby="dur">
            <h2 id="dur" className="font-sans text-base font-semibold">ხანგრძლივობა</h2>
            <div role="radiogroup" aria-labelledby="dur" className="mt-4 flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={days === d}
                  onClick={() => setDays(d)}
                  className={`${optionBase} h-11 flex-1 rounded-full px-5 text-sm sm:flex-none ${days === d ? "border-foreground bg-foreground text-background" : "border-border hover:border-sage"}`}
                >
                  {d} დღე
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="add">
            <h2 id="add" className="font-sans text-base font-semibold">დამატებითი სერვისები</h2>
            <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              <label className="flex cursor-pointer items-start gap-4 p-5">
                <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
                <span className="flex-1">
                  <span className="flex justify-between gap-3 font-medium"><span>გამორჩევა</span><span>{formatTetri(data.prices.highlight)} / დღე</span></span>
                  <span className="mt-1 block text-sm text-muted-foreground">ბარათი კატალოგში ნაზი მწვანე ფონით გამოირჩევა.</span>
                </span>
              </label>
              <fieldset className="p-5">
                <legend className="flex w-full justify-between gap-3 font-medium"><span>ავტომატური აწევა</span><span>{formatTetri(data.prices.bump)} / აწევა</span></legend>
                <p className="mt-1 text-sm text-muted-foreground">ნივთი სიაში თავიდან ადის. თავდაპირველი გამოქვეყნების თარიღი არ იცვლება.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([["none", "არა"], ["once", "ერთჯერადად"], ["daily", `ყოველდღე (${days}×)`]] as const).map(([value, label]) => (
                    <label key={value} className={`${ease} cursor-pointer rounded-full border px-4 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${bump === value ? "border-foreground" : "border-border hover:border-sage"}`}>
                      <input type="radio" name="bump" value={value} checked={bump === value} onChange={() => setBump(value)} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-6">
            <h2 className="font-sans text-base font-semibold">შეჯამება</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">განცხადების საფასური</dt>
                <dd>უკვე გადახდილია</dd>
              </div>
              {lines.length === 0 && <p className="text-muted-foreground">სერვისი არ არის არჩეული.</p>}
              {lines.map((line) => (
                <div key={line.label} className="flex justify-between gap-3">
                  <dt><span>{line.label}</span><span className="block text-xs text-muted-foreground">{line.detail}</span></dt>
                  <dd>{formatTetri(line.tetri)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm">სულ</span>
              <span className="text-2xl font-semibold tracking-tight">{formatTetri(total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">ბალანსი: {formatTetri(data.balance)}</p>
            {total > 0 && (
              <div className="mt-4">
                <LegalConsent
                  id="promotion-legal-consent"
                  checked={legalAccepted}
                  onChange={setLegalAccepted}
                  kind="promotion"
                  amountTetri={total}
                  disabled={busy}
                />
              </div>
            )}
            <Button
              className="mt-5 h-12 w-full rounded-full"
              disabled={busy || total === 0 || !enough || !live || !legalAccepted}
              onClick={() => void pay()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              ბალანსით გადახდა
            </Button>
            <Button variant="outline" className="mt-2 h-12 w-full rounded-full" disabled>
              ბარათით გადახდა
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">ონლაინ გადახდა მალე დაემატება</p>
            <Link to="/product/$id" params={{ id }} className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
              გაგრძელება პრომოს გარეშე
            </Link>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm">სულ <strong className="ml-1 text-lg">{formatTetri(total)}</strong></span>
        <span className="text-xs text-muted-foreground">ონლაინ გადახდა მალე დაემატება</span>
      </div>
    </div>
  );
}
