import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Confirm, PageTitle, StateBox, inputCls } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { adminSaveSettings, adminSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: SettingsPage });

const PRICE_FIELDS = [
  ["vip", "VIP · დღე"], ["vip_plus", "VIP+ · დღე"], ["super_vip", "SUPER VIP · დღე"],
  ["highlight", "ფერის გამოკვეთა · დღე"], ["bump", "ავტომატური განახლება · ჯერზე"],
] as const;
type PriceCode = (typeof PRICE_FIELDS)[number][0];

// Inputs are in lari; stored and validated as integer tetri.
const toTetri = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
const toGel = (t: number) => (t / 100).toFixed(2);

function SettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminSettings() });
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [firstFree, setFirstFree] = useState(true);
  useEffect(() => {
    if (!q.data) return;
    const s = q.data.settings;
    setForm({
      fee: toGel(s.listing_fee_tetri), email: s.contact_email, phone: s.contact_phone, note: s.moderation_note,
      ...Object.fromEntries(PRICE_FIELDS.map(([c]) => [c, toGel(q.data.prices[c] ?? 0)])),
    });
    setFirstFree(s.first_listing_free);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const prices = Object.fromEntries(PRICE_FIELDS.map(([c]) => [c, toTetri(form[c] ?? "")])) as Record<PriceCode, number>;
      return adminSaveSettings({ data: { fee: toTetri(form["fee"] ?? ""), firstFree, email: form["email"] ?? "", phone: form["phone"] ?? "", note: form["note"] ?? "", prices } });
    },
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.message);
      else toast.success("პარამეტრები შენახულია");
      void qc.invalidateQueries();
    },
    onError: () => toast.error("შეამოწმეთ მნიშვნელობები — თანხები უნდა იყოს 0 ან მეტი."),
  });

  if (q.isLoading) return <StateBox state="loading" />;
  if (q.isError || !q.data) return <StateBox state="error" onRetry={() => void q.refetch()} />;
  const field = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input className={`${inputCls} mt-1 w-full`} value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
    </label>
  );

  return (
    <div className="space-y-6">
      <PageTitle title="პარამეტრები" hint="ფასები ინახება სერვერზე, თეთრებში. ცვლილება ძველ გადახდებს არ ეხება." />
      <section className="surface space-y-4 p-6">
        <h2 className="text-sm font-semibold">განცხადების საფასური</h2>
        {field("fee", "საფასური (₾)", { inputMode: "decimal" })}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={firstFree} onChange={(e) => setFirstFree(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
          პირველი განცხადება უფასოა
        </label>
      </section>
      <section className="surface p-6">
        <h2 className="text-sm font-semibold">პრომო ფასები (₾)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{PRICE_FIELDS.map(([c, l]) => <div key={c}>{field(c, l, { inputMode: "decimal" })}</div>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">ხანგრძლივობა: 1, 3 ან 7 დღე (ფიქსირებული).</p>
      </section>
      <section className="surface space-y-4 p-6">
        <h2 className="text-sm font-semibold">კონტაქტი და მოდერაცია</h2>
        {field("email", "საკონტაქტო ელფოსტა", { type: "email" })}
        {field("phone", "საკონტაქტო ტელეფონი")}
        <label className="block text-sm">
          <span className="text-muted-foreground">მოდერაციის წესები (შიდა შენიშვნა)</span>
          <textarea className={`${inputCls} mt-1 h-28 w-full py-2`} value={form["note"] ?? ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} maxLength={2000} />
        </label>
      </section>
      <Confirm title="პარამეტრების შენახვა?" description="ახალი ფასები ამოქმედდება მომდევნო გადახდებზე. ცვლილება აუდიტში ჩაიწერება." action="შენახვა"
        onConfirm={() => save.mutate()}
        trigger={<Button className="rounded-full px-8" disabled={save.isPending}>შენახვა</Button>} />
    </div>
  );
}
