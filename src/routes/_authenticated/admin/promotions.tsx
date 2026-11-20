import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Pager, PageTitle, Pill, StateBox, tableWrap, td, th } from "@/components/admin/AdminUi";
import { adminPromotions } from "@/lib/admin.functions";
import { TIER_NAME, fmtDate } from "@/lib/admin-labels";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/promotions")({ component: PromotionsPage });

function PromotionsPage() {
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ["admin", "promotions", page], queryFn: () => adminPromotions({ data: { page } }) });
  return (
    <div>
      <PageTitle title="პრომო სერვისები" hint="ადმინს პრომოს უფასოდ მინიჭება არ შეუძლია — პრომო ჩაირთვება მხოლოდ დადასტურებული გადახდით." />
      {list.isLoading ? <StateBox state="loading" /> : list.isError || !list.data ? <StateBox state="error" onRetry={() => void list.refetch()} /> :
        list.data.rows.length === 0 ? <StateBox state="empty" empty="პრომო სერვისი ჯერ არავის უყიდია." /> : (
        <>
          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead className="border-b border-border"><tr>
                <th className={th}>განცხადება</th><th className={th}>სერვისი</th><th className={th}>პერიოდი</th><th className={th}>თანხა</th><th className={th}>გადახდა</th><th className={th}>სტატუსი</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {list.data.rows.map((p) => {
                  const live = new Date(p.ends_at) > new Date();
                  return (
                    <tr key={p.id}>
                      <td className={td}><p className="font-medium">{p.product_title}</p><p className="text-xs text-muted-foreground">@{p.seller_username}</p></td>
                      <td className={td}>{[p.tier ? TIER_NAME[p.tier] : null, p.highlight ? "გამოკვეთა" : null, p.bump_mode !== "none" ? (p.bump_mode === "daily" ? "განახლება ყოველდღე" : "განახლება ერთხელ") : null].filter(Boolean).join(" · ")}</td>
                      <td className={td}>{fmtDate(p.starts_at)} – {fmtDate(p.ends_at)}</td>
                      <td className={td}>{formatTetri(p.amount_tetri)}</td>
                      <td className={td}>{p.paid ? <Pill tone="sage">დადასტურებული</Pill> : <Pill tone="warn">არ დასტურდება</Pill>}</td>
                      <td className={td}>{live ? <Pill tone="dark">მოქმედი</Pill> : <Pill>ვადაგასული</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
