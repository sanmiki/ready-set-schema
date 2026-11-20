import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Pager, PageTitle, Pill, StateBox, inputCls } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { adminReports, adminUpdateReport } from "@/lib/admin.functions";
import { REPORT_STATUS, fmtDate, reasonLabel } from "@/lib/admin-labels";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: ReportsPage });

type Status = "all" | "new" | "under_review" | "resolved" | "dismissed";

function ReportsPage() {
  const [status, setStatus] = useState<Status>("new");
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ["admin", "reports", status, page], queryFn: () => adminReports({ data: { status, page } }) });
  return (
    <div>
      <PageTitle title="საჩივრები" />
      <select className={`${inputCls} mb-4`} value={status} onChange={(e) => { setStatus(e.target.value as Status); setPage(0); }}>
        <option value="all">ყველა</option>
        {Object.entries(REPORT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {list.isLoading ? <StateBox state="loading" /> : list.isError || !list.data ? <StateBox state="error" onRetry={() => void list.refetch()} /> :
        list.data.rows.length === 0 ? <StateBox state="empty" empty="საჩივრები არ არის." /> : (
        <>
          <ul className="space-y-3">{list.data.rows.map((r) => <ReportRow key={r.id} r={r} />)}</ul>
          <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof adminReports>>["rows"][number];

function ReportRow({ r }: { r: Row }) {
  const [decision, setDecision] = useState(r.admin_decision ?? "");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (s: "under_review" | "resolved" | "dismissed") => adminUpdateReport({ data: { id: r.id, status: s, decision } }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.message);
      else toast.success("შენახულია");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={r.status === "new" ? "dark" : r.status === "resolved" ? "sage" : "muted"}>{REPORT_STATUS[r.status]}</Pill>
        <span className="font-medium">{reasonLabel(r.reason)}</span>
        <span className="text-xs text-muted-foreground">@{r.reporter_username} · {fmtDate(r.created_at)}</span>
      </div>
      <p className="mt-2 text-sm">
        {r.product_id && (r.product_title ? <>განცხადება: <Link to="/product/$id" params={{ id: r.product_id }} className="underline">{r.product_title}</Link></> : "განცხადება წაშლილია")}
        {r.reported_user_id && <> · მომხმარებელი: @{r.reported_username ?? "—"}</>}
      </p>
      {r.details && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm">{r.details}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} min-w-60 flex-1`} placeholder="ადმინის გადაწყვეტილება" value={decision} onChange={(e) => setDecision(e.target.value)} maxLength={1000} />
        <Button size="sm" variant="ghost" className="rounded-full" disabled={mut.isPending} onClick={() => mut.mutate("under_review")}>განხილვაში</Button>
        <Button size="sm" className="rounded-full" disabled={mut.isPending} onClick={() => mut.mutate("resolved")}>გადაწყვეტა</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={mut.isPending} onClick={() => mut.mutate("dismissed")}>უარყოფა</Button>
      </div>
    </li>
  );
}
