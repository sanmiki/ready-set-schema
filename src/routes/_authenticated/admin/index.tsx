import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageTitle, StateBox } from "@/components/admin/AdminUi";
import { adminStats } from "@/lib/admin.functions";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

function Overview() {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => adminStats() });
  if (q.isLoading) return <StateBox state="loading" />;
  if (q.isError || !q.data) return <StateBox state="error" onRetry={() => void q.refetch()} />;
  const s = q.data;
  const cards = [
    ["რეგისტრირებული მომხმარებელი", s.users, `${s.suspended} შეჩერებული`],
    ["სულ განცხადება", s.listings, `${s.hidden} დამალული`],
    ["აქტიური განცხადება", s.active, ""],
    ["გაყიდული", s.sold, ""],
    ["ღია საჩივარი", s.open_reports, "ახალი ან განხილვაში"],
    ["პრომო სერვისი", s.promotions, `${s.active_promotions} მოქმედი`],
  ] as const;
  const max = Math.max(1, ...s.signups_30d.map((d) => d.n));
  return (
    <div>
      <PageTitle title="მიმოხილვა" hint="ყველა რიცხვი რეალური მონაცემებიდანაა." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="surface p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">შემოსავალი</h2>
          {s.paid_payments === 0 ? (
            <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">გადახდები ჯერ არ არის გააქტიურებული</p>
          ) : (
            <p className="mt-2 text-2xl font-semibold">{formatTetri(s.paid_tetri)}</p>
          )}
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">ბალანსიდან — განცხადების საფასური</dt><dd>{formatTetri(s.fee_tetri)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">ბალანსიდან — პრომო</dt><dd>{formatTetri(s.promotion_tetri)}</dd></div>
          </dl>
        </section>
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">ახალი რეგისტრაციები · 30 დღე</h2>
          {s.signups_30d.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">ბოლო 30 დღეში რეგისტრაცია არ ყოფილა.</p>
          ) : (
            <div className="mt-4 flex h-28 items-end gap-1" aria-label="რეგისტრაციები დღეების მიხედვით">
              {s.signups_30d.map((d) => (
                <div key={d.day} title={`${d.day}: ${d.n}`} className="flex-1 rounded-t bg-sage" style={{ height: `${(d.n / max) * 100}%`, minHeight: 4 }} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
