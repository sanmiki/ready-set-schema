import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Pager, PageTitle, StateBox, tableWrap, td, th } from "@/components/admin/AdminUi";
import { adminAudit } from "@/lib/admin.functions";
import { AUDIT_ACTION } from "@/lib/admin-labels";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: AuditPage });

function AuditPage() {
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ["admin", "audit", page], queryFn: () => adminAudit({ data: { page } }) });
  return (
    <div>
      <PageTitle title="აუდიტის ჟურნალი" hint="ყველა ადმინისტრაციული ქმედება. ჩანაწერების შეცვლა ან წაშლა შეუძლებელია." />
      {list.isLoading ? <StateBox state="loading" /> : list.isError || !list.data ? <StateBox state="error" onRetry={() => void list.refetch()} /> :
        list.data.rows.length === 0 ? <StateBox state="empty" empty="ქმედებები ჯერ არ არის." /> : (
        <>
          <div className={tableWrap}><table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className={th}>დრო</th><th className={th}>ქმედება</th><th className={th}>ობიექტი</th><th className={th}>ადმინი</th><th className={th}>დეტალები</th></tr></thead>
            <tbody className="divide-y divide-border">{list.data.rows.map((a) => (
              <tr key={a.id}>
                <td className={td}>{new Date(a.created_at).toLocaleString("ka-GE")}</td>
                <td className={td}>{AUDIT_ACTION[a.action] ?? a.action}</td>
                <td className={`${td} font-mono text-xs`}>{a.target_type}:{a.target_id?.slice(0, 8)}</td>
                <td className={`${td} font-mono text-xs`}>{a.admin_id.slice(0, 8)}</td>
                <td className={`${td} max-w-xs truncate font-mono text-xs text-muted-foreground`} title={JSON.stringify(a.meta)}>{JSON.stringify(a.meta)}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
