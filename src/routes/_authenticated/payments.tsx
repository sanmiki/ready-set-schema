import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listMyPayments } from "@/lib/payments.functions";
import { PAY_SERVICE_KA, PAY_STATUS_KA, REFUND_KA } from "@/lib/payment-labels";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "გადახდების ისტორია · MEORADI" },
      { name: "description", content: "თქვენი ბარათით გადახდები MEORADI-ზე." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "გადახდების ისტორია · MEORADI" },
      { property: "og:description", content: "ბარათით გადახდების ისტორია." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const q = useQuery({ queryKey: ["my-payments"], queryFn: () => listMyPayments() });
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">გადახდების ისტორია</h1>
      <p className="mt-2 text-sm text-muted-foreground">ბარათით გადახდები Flitt-ის მეშვეობით. ბარათის მონაცემებს MEORADI არ ინახავს.</p>
      {q.isLoading && <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {q.isError && <div className="py-16 text-center text-sm">ისტორია ვერ ჩაიტვირთა. <Button variant="link" onClick={() => void q.refetch()}>თავიდან ცდა</Button></div>}
      {q.data && q.data.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">ბარათით გადახდები ჯერ არ გაქვთ.</p>}
      {q.data && q.data.length > 0 && (
        <ul className="mt-8 divide-y divide-border surface">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link to="/payment/$id" params={{ id: p.id }} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50">
                <span>
                  <span className="block font-medium">{PAY_SERVICE_KA[p.service ?? ""] ?? "გადახდა"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("ka-GE")}{p.environment === "sandbox" ? " · ტესტი" : ""}
                    {p.refund_status !== "none" ? ` · დაბრუნება: ${REFUND_KA[p.refund_status]}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{formatTetri(p.amount_tetri)}</span>
                  <span className="text-xs text-muted-foreground">{PAY_STATUS_KA[p.status] ?? p.status}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
