import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle, Ban, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelPayment, getPayment } from "@/lib/payments.functions";
import { PAY_SERVICE_KA, isActivated } from "@/lib/payment-labels";
import { formatTetri } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/payment/$id")({
  head: () => ({
    meta: [
      { title: "გადახდის სტატუსი · MEORADI" },
      { name: "description", content: "ბარათით გადახდის შედეგი MEORADI-ზე." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "გადახდის სტატუსი · MEORADI" },
      { property: "og:description", content: "ბარათით გადახდის შედეგი." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [tries, setTries] = useState(0);
  const q = useQuery({
    queryKey: ["payment", id],
    queryFn: () => getPayment({ data: { id, sync: true } }),
    refetchInterval: (query) => (query.state.data?.status === "pending" && tries < 20 ? 3000 : false),
  });
  useEffect(() => { if (q.data?.status === "pending") setTries((t) => t + 1); }, [q.dataUpdatedAt]);
  useEffect(() => { if (q.data && q.data.status !== "pending") void queryClient.invalidateQueries({ queryKey: ["my-listings"] }); }, [q.data?.status]);

  if (q.isLoading) return <Shell icon={<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />} title="მოწმდება გადახდა…" />;
  if (q.isError) return <Shell icon={<AlertTriangle className="h-10 w-10 text-destructive" />} title="სტატუსის ჩატვირთვა ვერ მოხერხდა" text="განაახლეთ გვერდი." retry={() => void q.refetch()} />;
  const p = q.data;
  if (!p) return <Shell icon={<XCircle className="h-10 w-10 text-muted-foreground" />} title="გადახდა ვერ მოიძებნა" />;

  const summary = `${PAY_SERVICE_KA[p.service ?? ""] ?? "სერვისი"} · ${formatTetri(p.amount_tetri)}${p.environment === "sandbox" ? " · სატესტო რეჟიმი" : ""}`;
  if (p.status === "paid" && isActivated(p.activation_result))
    return <Shell icon={<CheckCircle2 className="h-10 w-10 text-sage-deep" />} title="გადახდა წარმატებით დასრულდა" text={`${summary}. სერვისი გააქტიურდა.`} productId={p.product_id} />;
  if (p.status === "paid")
    return <Shell icon={<AlertTriangle className="h-10 w-10 text-destructive" />} title="გადახდა მიღებულია, სერვისი ვერ გააქტიურდა"
      text={`${summary}. თანხა ჩაირიცხა თქვენს ბალანსზე და შეგიძლიათ ბალანსით გამოიყენოთ, ან დაგვიკავშირდით.`} productId={p.product_id} />;
  if (p.status === "failed")
    return <Shell icon={<XCircle className="h-10 w-10 text-destructive" />} title="გადახდა ვერ შესრულდა" text={`${summary}. თანხა არ ჩამოიჭრა. სცადეთ თავიდან სხვა ბარათით.`} productId={p.product_id} />;
  if (p.status === "canceled")
    return <Shell icon={<Ban className="h-10 w-10 text-muted-foreground" />} title="გადახდა გაუქმდა" text={`${summary}. თანხა არ ჩამოიჭრა.`} productId={p.product_id} />;
  return (
    <Shell icon={<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />} title="გადახდა მუშავდება"
      text={`${summary}. ვამოწმებთ შედეგს Flitt-თან — არ დახუროთ გვერდი.`}>
      <Button variant="outline" className="mt-6 rounded-full" onClick={async () => { await cancelPayment({ data: { id } }); await q.refetch(); }}>
        გადახდის გაუქმება
      </Button>
    </Shell>
  );
}

function Shell(props: { icon: React.ReactNode; title: string; text?: string; productId?: string | null; retry?: () => void; children?: React.ReactNode }) {
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      {props.icon}
      <h1 className="mt-5 text-2xl">{props.title}</h1>
      {props.text && <p className="mt-2 max-w-md text-sm text-muted-foreground">{props.text}</p>}
      {props.children}
      {props.retry && <Button className="mt-6 rounded-full" onClick={props.retry}>თავიდან ცდა</Button>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {props.productId && <Button asChild className="rounded-full"><Link to="/product/$id" params={{ id: props.productId }}>ნივთის ნახვა</Link></Button>}
        <Button asChild variant="outline" className="rounded-full"><Link to="/my-items">ჩემი ნივთები</Link></Button>
        <Button asChild variant="outline" className="rounded-full"><Link to="/payments">გადახდების ისტორია</Link></Button>
      </div>
    </div>
  );
}
