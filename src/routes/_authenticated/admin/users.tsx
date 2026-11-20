import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Confirm, Pager, PageTitle, Pill, StateBox, inputCls, tableWrap, td, th } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { adminSetSuspension, adminUsers } from "@/lib/admin.functions";
import { fmtDate } from "@/lib/admin-labels";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: UsersPage });

type Status = "all" | "active" | "suspended" | "reported";

function UsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "users", q, status, page], queryFn: () => adminUsers({ data: { q, status, page } }) });
  const mut = useMutation({
    mutationFn: (v: { userId: string; suspend: boolean }) => adminSetSuspension({ data: { ...v, reason: "" } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.message);
      else toast.success("შენახულია");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  return (
    <div>
      <PageTitle title="მომხმარებლები" hint="პაროლები და შეტყობინებები აქ არ ჩანს." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-64`} placeholder="ძიება სახელით" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value as Status); setPage(0); }}>
          <option value="all">ყველა</option>
          <option value="active">აქტიური</option>
          <option value="suspended">შეჩერებული</option>
          <option value="reported">საჩივრით</option>
        </select>
      </div>
      {list.isLoading ? <StateBox state="loading" /> : list.isError || !list.data ? <StateBox state="error" onRetry={() => void list.refetch()} /> :
        list.data.rows.length === 0 ? <StateBox state="empty" empty="მომხმარებელი ვერ მოიძებნა." /> : (
        <>
          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead className="border-b border-border"><tr>
                <th className={th}>მომხმარებელი</th><th className={th}>რეგისტრაცია</th><th className={th}>განცხადებები</th><th className={th}>საჩივრები</th><th className={th}>სტატუსი</th><th className={th} />
              </tr></thead>
              <tbody className="divide-y divide-border">
                {list.data.rows.map((u) => (
                  <tr key={u.id} className="transition-colors duration-200 hover:bg-muted/40">
                    <td className={td}><p className="font-medium">{u.display_name || u.username}</p><p className="text-xs text-muted-foreground">@{u.username}{u.city ? ` · ${u.city}` : ""}</p></td>
                    <td className={td}>{fmtDate(u.created_at)}</td>
                    <td className={td}>{u.listings} <span className="text-xs text-muted-foreground">({u.active_listings} აქტ.)</span></td>
                    <td className={td}>{Number(u.reports) > 0 ? <Pill tone="warn">{u.reports}</Pill> : "0"}</td>
                    <td className={td}>{u.suspended ? <Pill tone="warn">შეჩერებული</Pill> : <Pill tone="sage">აქტიური</Pill>}</td>
                    <td className={`${td} text-right`}>
                      <Confirm
                        title={u.suspended ? "შეჩერების მოხსნა?" : "ანგარიშის შეჩერება?"}
                        description={u.suspended ? "მომხმარებელი ისევ შეძლებს განცხადებების დამატებას და მიწერას." : "შეჩერებული მომხმარებელი ვეღარ დაამატებს განცხადებას და ვეღარ მიწერს სხვებს. ქმედება აუდიტში ჩაიწერება."}
                        action={u.suspended ? "მოხსნა" : "შეჩერება"}
                        destructive={!u.suspended}
                        onConfirm={() => mut.mutate({ userId: u.id, suspend: !u.suspended })}
                        trigger={<Button variant="outline" size="sm" className="rounded-full" disabled={mut.isPending}>{u.suspended ? "მოხსნა" : "შეჩერება"}</Button>}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
