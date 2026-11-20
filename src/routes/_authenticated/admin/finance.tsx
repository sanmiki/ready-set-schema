import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageTitle, Pill, StateBox, tableWrap, td, th } from "@/components/admin/AdminUi";
import { adminFinance } from "@/lib/admin.functions";
import { LEDGER_KIND, PAYMENT_STATUS, fmtDate } from "@/lib/admin-labels";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/finance")({ component: FinancePage });

function FinancePage() {
  const q = useQuery({ queryKey: ["admin", "finance"], queryFn: () => adminFinance() });
  if (q.isLoading) return <StateBox state="loading" />;
  if (q.isError || !q.data) return <StateBox state="error" onRetry={() => void q.refetch()} />;
  const { payments, ledger } = q.data;
  return (
    <div className="space-y-8">
      <PageTitle title="ფინანსები" hint="მხოლოდ ნახვა. ბალანსების ხელით შეცვლა შეუძლებელია; ბალანსის ჟურნალი მხოლოდ ემატება." />
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">გადახდები ჯერ არ არის გააქტიურებული — TBC-ს ან საქართველოს ბანკის დაკავშირების შემდეგ აქ ბარათით გადახდები გამოჩნდება.</p>
      <section>
        <h2 className="mb-3 text-sm font-semibold">ბარათით გადახდები</h2>
        {payments.length === 0 ? <StateBox state="empty" empty="გადახდები ჯერ არ არის." /> : (
          <div className={tableWrap}><table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className={th}>თარიღი</th><th className={th}>მომხმარებელი</th><th className={th}>დანიშნულება</th><th className={th}>თანხა</th><th className={th}>სტატუსი</th></tr></thead>
            <tbody className="divide-y divide-border">{payments.map((p) => (
              <tr key={p.id}><td className={td}>{fmtDate(p.created_at)}</td><td className={td}>@{p.username}</td><td className={td}>{p.purpose === "topup" ? "შევსება" : "განცხადება"}</td><td className={td}>{formatTetri(p.amount_tetri)}</td>
                <td className={td}><Pill tone={p.status === "paid" ? "sage" : p.status === "failed" ? "warn" : "muted"}>{PAYMENT_STATUS[p.status] ?? p.status}</Pill></td></tr>
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
