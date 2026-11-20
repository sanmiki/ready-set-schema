import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { BUCKET } from "./media";

const FAIL = "ოპერაცია ვერ მოხერხდა. სცადეთ თავიდან.";
const page = z.object({ page: z.number().int().min(0).max(10000).default(0) });
const PAGE_SIZE = 25;


// Every admin RPC re-checks the role in the database; this guard just gives a clean 403.
async function assertAdmin(supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: boolean | null }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("forbidden");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_admin");
    return { admin: data === true };
  });

export type AdminStats = {
  users: number; suspended: number; listings: number; active: number; sold: number; hidden: number;
  open_reports: number; promotions: number; active_promotions: number; promotion_tetri: number;
  fee_tetri: number; paid_payments: number; paid_tetri: number; signups_30d: { day: string; n: number }[];
};

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { data, error } = await context.supabase.rpc("admin_stats");
    if (error) throw new Error("forbidden");
    return data as unknown as AdminStats;
  });

export const adminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    page.extend({ q: z.string().max(100).default(""), status: z.enum(["all", "active", "suspended", "reported"]).default("all") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_users", {
      _q: data.q, _status: data.status, _limit: PAGE_SIZE, _offset: data.page * PAGE_SIZE,
    });
    if (error) throw new Error("forbidden");
    return { rows: rows ?? [], total: Number(rows?.[0]?.total ?? 0), pageSize: PAGE_SIZE };
  });

export const adminSetSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), suspend: z.boolean(), reason: z.string().max(500).default("") }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_set_suspension", { _user_id: data.userId, _suspend: data.suspend, _reason: data.reason });
    if (error) return { ok: false as const, message: FAIL };
    if (r === "self") return { ok: false as const, message: "საკუთარ ანგარიშს ვერ შეაჩერებთ." };
    return r === "ok" ? { ok: true as const } : { ok: false as const, message: FAIL };
  });

export const adminListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    page.extend({
      q: z.string().max(100).default(""),
      status: z.enum(["all", "active", "draft", "reserved", "sold", "hidden", "reported"]).default("all"),
      category: z.string().uuid().nullable().default(null),
      since: z.enum(["any", "7", "30", "90"]).default("any"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const since = data.since === "any" ? null : new Date(Date.now() - Number(data.since) * 86400000).toISOString();
    const { data: rows, error } = await context.supabase.rpc("admin_listings", {
      _q: data.q, _status: data.status, _category: data.category as string, _since: since as string,
      _limit: PAGE_SIZE, _offset: data.page * PAGE_SIZE,
    });
    if (error) throw new Error("forbidden");
    // Hidden/draft photos are owner-only in storage; sign them only after the admin check above passed.
    await assertAdmin(context.supabase as never);
    const paths = (rows ?? []).map((r) => r.image_path).filter((p): p is string => !!p);
    let urls: Record<string, string> = {};
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 600);
      urls = Object.fromEntries((signed ?? []).filter((s) => !!s.signedUrl && !!s.path).map((s) => [s.path as string, s.signedUrl as string]));
    }
    return {
      rows: (rows ?? []).map((r) => ({ ...r, image: r.image_path ? urls[r.image_path] ?? null : null })),
      total: Number(rows?.[0]?.total ?? 0),
      pageSize: PAGE_SIZE,
    };
  });

export const adminModerateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["hide", "prohibit", "restore"]), reason: z.string().max(500).default("") }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_moderate_listing", { _product_id: data.id, _action: data.action, _reason: data.reason });
    if (error || r !== "ok") return { ok: false as const, message: FAIL };
    return { ok: true as const };
  });

export const adminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => page.extend({ status: z.enum(["all", "new", "under_review", "resolved", "dismissed"]).default("all") }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_reports", { _status: data.status, _limit: PAGE_SIZE, _offset: data.page * PAGE_SIZE });
    if (error) throw new Error("forbidden");
    return { rows: rows ?? [], total: Number(rows?.[0]?.total ?? 0), pageSize: PAGE_SIZE };
  });

export const adminUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "under_review", "resolved", "dismissed"]), decision: z.string().max(1000).default("") }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_update_report", { _report_id: data.id, _status: data.status, _decision: data.decision });
    if (error || r !== "ok") return { ok: false as const, message: FAIL };
    return { ok: true as const };
  });

export const adminPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => page.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_promotions", { _limit: PAGE_SIZE, _offset: data.page * PAGE_SIZE });
    if (error) throw new Error("forbidden");
    return { rows: rows ?? [], total: Number(rows?.[0]?.total ?? 0), pageSize: PAGE_SIZE };
  });

export type FinanceData = {
  payments: { id: string; purpose: string; amount_tetri: number; status: string; provider: string | null; created_at: string; username: string }[];
  ledger: { id: string; kind: string; amount_tetri: number; created_at: string; username: string; product_id: string | null }[];
};

export const adminFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceData> => {
    const { data, error } = await context.supabase.rpc("admin_finance", { _limit: 200 });
    if (error) throw new Error("forbidden");
    return data as unknown as FinanceData;
  });

export const adminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never);
    const [s, p] = await Promise.all([
      context.supabase.from("platform_settings").select("listing_fee_tetri,first_listing_free,contact_email,contact_phone,moderation_note,updated_at").single(),
      context.supabase.from("promotion_prices").select("code,tetri"),
    ]);
    if (s.error || p.error) throw new Error("settings");
    return { settings: s.data, prices: Object.fromEntries(p.data.map((r) => [r.code, r.tetri])) as Record<string, number> };
  });

const tetri = z.number().int().min(0).max(1000000);
export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      fee: z.number().int().min(0).max(100000),
      firstFree: z.boolean(),
      email: z.string().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "ელფოსტა არასწორია"),
      phone: z.string().max(50),
      note: z.string().max(2000),
      prices: z.object({ vip: tetri, vip_plus: tetri, super_vip: tetri, highlight: tetri, bump: tetri }),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_update_settings", {
      _fee: data.fee, _first_free: data.firstFree, _email: data.email, _phone: data.phone, _note: data.note, _prices: data.prices,
    });
    if (error || r !== "ok") return { ok: false as const, message: FAIL };
    return { ok: true as const };
  });

export const adminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => page.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { data: rows, error, count } = await context.supabase
      .from("admin_audit_log")
      .select("id,admin_id,action,target_type,target_id,meta,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error("audit");
    return { rows: rows ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
  });

// Public-facing: any signed-in user can report a listing or user.
export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      productId: z.string().uuid().nullable(),
      userId: z.string().uuid().nullable(),
      reason: z.enum(["suspicious", "prohibited", "misleading", "fraud", "inappropriate"]),
      details: z.string().trim().max(1000).default(""),
    }).refine((v) => v.productId || v.userId).parse(i),
  )
  .handler(async ({ data, context }) => {
    let reported = data.userId;
    if (data.productId && !reported) {
      const { data: p } = await context.supabase.from("products").select("seller_id").eq("id", data.productId).maybeSingle();
      if (!p) return { ok: false as const, message: "განცხადება ვერ მოიძებნა." };
      reported = p.seller_id;
    }
    if (reported === context.userId) return { ok: false as const, message: "საკუთარ თავზე ვერ გააგზავნით." };
    const { error } = await context.supabase.from("reports").insert({
      reporter_id: context.userId, product_id: data.productId, reported_user_id: reported, reason: data.reason, details: data.details,
    });
    if (error) return { ok: false as const, message: FAIL };
    return { ok: true as const };
  });
