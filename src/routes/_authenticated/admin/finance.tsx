import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageTitle, Pill, StateBox, tableWrap, td, th } from "@/components/admin/AdminUi";
import { adminFinance } from "@/lib/admin.functions";
import { adminPayments } from "@/lib/payments.functions";
import { PAY_SERVICE_KA, PAY_STATUS_KA, REFUND_KA } from "@/lib/payment-labels";
import { LEDGER_KIND, fmtDate } from "@/lib/admin-labels";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/finance")({ component: FinancePage });

function FinancePage() {
  const q = useQuery({ queryKey: ["admin", "finance"], queryFn: () => adminFinance() });
  const pq = useQuery({ queryKey: ["admin", "payments"], queryFn: () => adminPayments() });
  if (q.isLoading || pq.isLoading) return <StateBox state="loading" />;
  if (q.isError || !q.data || pq.isError || !pq.data) return <StateBox state="error" onRetry={() => { void q.refetch(); void pq.refetch(); }} />;
  const { ledger } = q.data;
  const { payments, stats, events } = pq.data;
  return (
    <div className="space-y-8">
      <PageTitle title="ფინანსები" hint="მხოლოდ ნახვა. ბალანსების ხელით შეცვლა შეუძლებელია; ბალანსის ჟურნალი მხოლოდ ემატება." />
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Flitt — მხოლოდ სატესტო რეჟიმი. რეალური გადახდები გამორთულია. თანხის დაბრუნება ხელით ხდება Flitt-ის კაბინეტიდან; აქ მხოლოდ ჩანაწერებია.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["გადახდილი", `${stats.paid_count} · ${formatTetri(stats.paid_tetri)}`], ["მუშავდება", String(stats.pending_count)], ["წარუმატებელი", String(stats.failed_count)], ["დაბრუნებული", formatTetri(stats.refunded_tetri)]].map(([k, v]) => (
          <div key={k} className="surface p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-lg font-semibold">{v}</p></div>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold">ბარათით გადახდები</h2>
        {payments.length === 0 ? <StateBox state="empty" empty="გადახდები ჯერ არ არის." /> : (
          <div className={tableWrap}><table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className={th}>თარიღი</th><th className={th}>მომხმარებელი</th><th className={th}>სერვისი</th><th className={th}>თანხა</th><th className={th}>სტატუსი</th><th className={th}>გააქტიურება</th><th className={th}>Flitt ID</th><th className={th}>დაბრუნება</th></tr></thead>
            <tbody className="divide-y divide-border">{payments.map((p) => (
              <tr key={p.id}><td className={td}>{fmtDate(p.created_at)}</td><td className={td}>@{p.username}</td><td className={td}>{PAY_SERVICE_KA[p.service ?? ""] ?? "—"}{p.environment === "sandbox" ? " (ტესტი)" : ""}</td><td className={td}>{formatTetri(p.amount_tetri)} {p.currency}</td>
                <td className={td}><Pill tone={p.status === "paid" ? "sage" : p.status === "failed" ? "warn" : "muted"}>{PAY_STATUS_KA[p.status] ?? p.status}</Pill>{p.failure_reason ? <span className="block text-xs text-muted-foreground">{p.failure_reason}</span> : null}</td>
                <td className={td}>{p.activation_result ?? "—"}</td><td className={td}>{p.provider_payment_id ?? "—"}</td><td className={td}>{REFUND_KA[p.refund_status] ?? p.refund_status}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">გადახდის მოვლენები</h2>
        {events.length === 0 ? <StateBox state="empty" empty="მოვლენები ჯერ არ არის." /> : (
          <div className={tableWrap}><table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className={th}>თარიღი</th><th className={th}>წყარო</th><th className={th}>ხელმოწერა</th><th className={th}>Flitt სტატუსი</th><th className={th}>შედეგი</th></tr></thead>
            <tbody className="divide-y divide-border">{events.map((e) => (
              <tr key={e.id}><td className={td}>{fmtDate(e.created_at)}</td><td className={td}>{e.source}</td><td className={td}>{e.signature_valid === false ? "არასწორი" : e.signature_valid ? "სწორი" : "—"}</td><td className={td}>{e.order_status ?? "—"}</td><td className={td}>{e.outcome}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">ბალანსის ჟურნალი</h2>
        {ledger.length === 0 ? <StateBox state="empty" empty="ჩანაწერები ჯერ არ არის." /> : (
          <div className={tableWrap}><table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className={th}>თარიღი</th><th className={th}>მომხმარებელი</th><th className={th}>ტიპი</th><th className={th}>თანხა</th></tr></thead>
            <tbody className="divide-y divide-border">{ledger.map((l) => (
              <tr key={l.id}><td className={td}>{fmtDate(l.created_at)}</td><td className={td}>@{l.username}</td><td className={td}>{LEDGER_KIND[l.kind] ?? l.kind}</td>
                <td className={`${td} font-medium`}>{l.amount_tetri > 0 ? "+" : ""}{formatTetri(l.amount_tetri)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
