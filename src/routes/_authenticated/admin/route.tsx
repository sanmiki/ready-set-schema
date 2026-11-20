import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { BarChart3, Flag, Megaphone, ScrollText, Settings, Shirt, Users, Wallet } from "lucide-react";

import { amIAdmin } from "@/lib/admin.functions";

const NAV = [
  { to: "/admin", label: "მიმოხილვა", icon: BarChart3, exact: true },
  { to: "/admin/users", label: "მომხმარებლები", icon: Users },
  { to: "/admin/listings", label: "განცხადებები", icon: Shirt },
  { to: "/admin/reports", label: "საჩივრები", icon: Flag },
  { to: "/admin/promotions", label: "პრომო", icon: Megaphone },
  { to: "/admin/finance", label: "ფინანსები", icon: Wallet },
  { to: "/admin/settings", label: "პარამეტრები", icon: Settings },
  { to: "/admin/audit", label: "აუდიტი", icon: ScrollText },
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  // UX gate only — every admin server function and database function re-checks the role.
  beforeLoad: async () => {
    const { admin } = await amIAdmin().catch(() => ({ admin: false }));
    if (!admin) throw redirect({ to: "/access-denied" });
  },
  head: () => ({
    meta: [
      { title: "ადმინისტრირება · MEORADI" },
      { name: "description", content: "MEORADI-ის ადმინისტრირების პანელი." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "ადმინისტრირება · MEORADI" },
      { property: "og:description", content: "MEORADI-ის ადმინისტრირების პანელი." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside>
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">MEORADI · ადმინი</p>
        <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item }}
              className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-card hover:text-foreground data-[status=active]:bg-card data-[status=active]:font-medium data-[status=active]:text-foreground data-[status=active]:shadow-card"
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}
