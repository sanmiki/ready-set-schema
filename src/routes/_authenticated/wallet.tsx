import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { formatTetri, TOPUP_CHOICES_TETRI } from "@/lib/pricing";
import { myWalletQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "ჩემი ბალანსი · ReWear" },
      { name: "description", content: "ReWear-ის ბალანსი, შევსება და ტრანზაქციების ისტორია." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ჩემი ბალანსი · ReWear" },
      { property: "og:description", content: "განცხადების საფასურის გადახდა ReWear-ის ბალანსით." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
});

const KIND_LABEL = { topup: "ბალანსის შევსება", listing_charge: "განცხადების საფასური", refund: "დაბრუნება" } as const;

function WalletPage() {
  const { user } = useSession();
  const { data, isLoading, isError, refetch } = useQuery(myWalletQuery(user?.id ?? null));

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl">ჩემი ბალანსი</h1>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Wallet className="h-5 w-5" aria-hidden />
          <span className="text-sm">ხელმისაწვდომი ბალანსი</span>
        </div>
        <p className="mt-2 text-4xl font-semibold">
          {isLoading || !data ? (isError ? "—" : "…") : formatTetri(data.balance)}
        </p>
        {data && (
          <p className="mt-2 text-sm text-muted-foreground">
            {data.nextFee === 0
              ? "პირველი განცხადება უფასოა."
              : `შემდეგი განცხადების საფასური: ${formatTetri(data.nextFee)}`}
          </p>
        )}
        {isError && (
          <Button variant="outline" className="mt-3 rounded-full" onClick={() => void refetch()}>
            ბალანსი ვერ ჩაიტვირთა — თავიდან ცდა
          </Button>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">ბალანსის შევსება</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {TOPUP_CHOICES_TETRI.map((amount) => (
            <Button key={amount} variant="outline" size="lg" className="rounded-full" disabled>
              {(amount / 100).toFixed(0)} ₾
            </Button>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          ბალანსის შევსება დროებით მიუწვდომელია — ბანკის ონლაინ გადახდა ჯერ არ არის დაკავშირებული.
        </p>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">პირობები</p>
          <p>ბალანსი არის ReWear-ის კრედიტი, რომელიც გამოიყენება მხოლოდ განცხადების საფასურისთვის.</p>
          <p>თანხის განაღდება ან სხვა მომხმარებლისთვის გადაცემა შეუძლებელია.</p>
          <p>გამოუყენებელი თანხის დაბრუნება შესაძლებელია მოთხოვნით, გადახდის პროვაიდერის წესების შესაბამისად.</p>
          <p>გამოქვეყნებული განცხადების საფასური არ ბრუნდება წაშლის, დაჯავშნის ან გაყიდვის შემთხვევაში.</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">ტრანზაქციების ისტორია</h2>
        {data && data.transactions.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">ტრანზაქციები ჯერ არ არის.</p>
        )}
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {data?.transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                {KIND_LABEL[tx.kind]}
                <span className="block text-xs text-muted-foreground">
                  {new Date(tx.created_at).toLocaleString("ka-GE")}
                </span>
              </span>
              <span className={tx.amount_tetri < 0 ? "text-destructive" : "text-primary"}>
                {tx.amount_tetri > 0 ? "+" : ""}
                {formatTetri(tx.amount_tetri)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
