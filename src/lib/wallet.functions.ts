import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WalletTx = {
  id: string;
  kind: "topup" | "listing_charge" | "refund";
  amount_tetri: number;
  created_at: string;
};

export type WalletSummary = { balance: number; nextFee: number; transactions: WalletTx[] };

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletSummary> => {
    const [balance, fee, txs] = await Promise.all([
      context.supabase.rpc("wallet_balance"),
      context.supabase.rpc("listing_fee_quote"),
      context.supabase
        .from("wallet_transactions")
        .select("id,kind,amount_tetri,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (balance.error || fee.error || txs.error) throw new Error("wallet");
    return { balance: balance.data ?? 0, nextFee: fee.data ?? 0, transactions: txs.data ?? [] };
  });
