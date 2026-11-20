import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Confirm, Pager, PageTitle, Pill, StateBox, inputCls } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { adminListings, adminModerateListing } from "@/lib/admin.functions";
import { LISTING_STATUS, fmtDate } from "@/lib/admin-labels";
import { formatPrice } from "@/lib/labels";
import { categoriesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/listings")({ component: ListingsPage });

type Status = "all" | "active" | "draft" | "reserved" | "sold" | "hidden" | "reported";
type Since = "any" | "7" | "30" | "90";

function ListingsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [since, setSince] = useState<Since>("any");
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery);
  const list = useQuery({
    queryKey: ["admin", "listings", q, status, category, since, page],
    queryFn: () => adminListings({ data: { q, status, category, since, page } }),
  });
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "hide" | "prohibit" | "restore" }) => adminModerateListing({ data: { ...v, reason: "" } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.message);
      else toast.success("შენახულია");
      void qc.invalidateQueries();
    },
  });
  const reset = () => setPage(0);

  return (
    <div>
      <PageTitle title="განცხადებები" hint="მფლობელი არ იცვლება. სამუდამო წაშლა არ ხდება — დამალული განცხადება შეიძლება აღდგეს." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-56`} placeholder="სათაური ან გამყიდველი" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value as Status); reset(); }}>
          <option value="all">ყველა სტატუსი</option>
          {Object.entries(LISTING_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="hidden">დამალული</option>
          <option value="reported">საჩივრით</option>
        </select>
        <select className={inputCls} value={category ?? ""} onChange={(e) => { setCategory(e.target.value || null); reset(); }}>
          <option value="">ყველა კატეგორია</option>
          {(cats.data ?? []).filter((c) => !c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={since} onChange={(e) => { setSince(e.target.value as Since); reset(); }}>
          <option value="any">ნებისმიერ დროს</option>
          <option value="7">ბოლო 7 დღე</option>
          <option value="30">ბოლო 30 დღე</option>
          <option value="90">ბოლო 90 დღე</option>
        </select>
      </div>
      {list.isLoading ? <StateBox state="loading" /> : list.isError || !list.data ? <StateBox state="error" onRetry={() => void list.refetch()} /> :
        list.data.rows.length === 0 ? <StateBox state="empty" empty="განცხადება ვერ მოიძებნა." /> : (
        <>
          <ul className="space-y-2">
            {list.data.rows.map((l) => (
              <li key={l.id} className="surface flex flex-wrap items-center gap-4 p-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(l.price)} · @{l.seller_username} · {l.category_name ?? "კატეგორიის გარეშე"} · {fmtDate(l.created_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {l.moderation ? <Pill tone="warn">{l.moderation === "prohibited" ? "აკრძალული" : "დამალული"}</Pill> : <Pill tone={l.status === "active" ? "sage" : "muted"}>{LISTING_STATUS[l.status]}</Pill>}
                    {Number(l.reports) > 0 && <Pill tone="warn">{l.reports} საჩივარი</Pill>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.status === "active" && !l.moderation && (
                    <Link to="/product/$id" params={{ id: l.id }} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">ნახვა</Link>
                  )}
                  {l.moderation ? (
                    <Confirm title="განცხადების აღდგენა?" description="განცხადება დაუბრუნდება წინა სტატუსს." action="აღდგენა"
                      onConfirm={() => mut.mutate({ id: l.id, action: "restore" })}
                      trigger={<Button size="sm" variant="outline" className="rounded-full">აღდგენა</Button>} />
                  ) : (
                    <>
                      <Confirm title="განცხადების დამალვა?" description="განცხადება გაქრება საიტიდან და გამყიდველი ვერ გამოაქვეყნებს თავიდან, სანამ არ აღადგენთ." action="დამალვა"
                        onConfirm={() => mut.mutate({ id: l.id, action: "hide" })}
                        trigger={<Button size="sm" variant="outline" className="rounded-full">დამალვა</Button>} />
                      <Confirm destructive title="აკრძალულად მონიშვნა?" description="განცხადება მოიხსნება როგორც აკრძალული ნივთი. ჩანაწერი რჩება და აუდიტში იწერება." action="მოხსნა"
                        onConfirm={() => mut.mutate({ id: l.id, action: "prohibit" })}
                        trigger={<Button size="sm" variant="ghost" className="rounded-full text-destructive">აკრძალულია</Button>} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
