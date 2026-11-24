import type React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { amIAdmin } from "@/lib/admin.functions";
import { useState } from "react";
import { ChevronDown, Heart, Menu, MessageCircle, Plus, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useInbox } from "@/hooks/useInbox";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

const navClass =
  "shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground";
const activeNavClass = "shrink-0 rounded-full px-3 py-1.5 bg-sage-soft font-medium text-foreground";

const drawerLink = "flex min-h-11 items-center rounded-xl px-3 text-foreground transition-colors hover:bg-muted";
const drawerActive = "flex min-h-11 items-center rounded-xl px-3 bg-sage-soft font-medium text-foreground";

export function SiteHeader() {
  const { user } = useSession();
  const inbox = useInbox();
  const unread = (inbox.data ?? []).reduce((sum, row) => sum + Number(row.unread_count), 0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: adminCheck } = useQuery({ queryKey: ["am-i-admin", user?.id ?? null], queryFn: () => amIAdmin(), enabled: !!user, staleTime: 300_000 });
  const isAdmin = adminCheck?.admin === true;
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-14 items-center gap-2 md:h-16 md:gap-6">
        <Link to="/" className="min-w-0 shrink truncate font-sans text-lg font-semibold sm:text-xl tracking-[0.08em]" aria-label="MEORADI — მთავარი">
          MEORADI<span className="text-primary"></span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="მთავარი ნავიგაცია">
          <Link to="/" className={navClass} activeProps={{ className: activeNavClass }} activeOptions={{ exact: true }}>
            მთავარი
          </Link>
          <Link to="/catalog" search={{}} className={navClass} activeProps={{ className: activeNavClass }}>
            კატალოგი
          </Link>
          {user && (
            <Link to="/my-items" className={navClass} activeProps={{ className: activeNavClass }}>
              ჩემი ნივთები
            </Link>
          )}
        </nav>

        <form
          role="search"
          className="relative ml-auto hidden max-w-xs flex-1 lg:block"
          onSubmit={(event) => {
            event.preventDefault();
            const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
            navigate({ to: "/catalog", search: q ? { q } : {} });
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            name="q"
            type="search"
            placeholder="მოძებნე ნივთი ან ბრენდი"
            aria-label="ძიება"
            className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0">
          <Button asChild variant="ghost" size="icon" className="rounded-full lg:hidden" title="ძიება">
            <Link to="/catalog" search={{}} aria-label="ძიება">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          {user && (
            <>
              <Button asChild variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" title="რჩეულები">
                <Link to="/favorites" aria-label="რჩეულები">
                  <Heart className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative rounded-full" title="შეტყობინებები">
                <Link to="/messages" search={{}} aria-label={unread ? `შეტყობინებები: ${unread} წაუკითხავი` : "შეტყობინებები"}>
                  <MessageCircle className="h-5 w-5" />
                  {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
                </Link>
              </Button>
            </>
          )}

          <Button asChild size="sm" className="ml-1 hidden h-10 rounded-full px-4 sm:inline-flex">
            <SellLink signedIn={!!user}>
              <Plus className="h-4 w-4" aria-hidden />
              გაყიდე
            </SellLink>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card p-1 pr-2 text-sm transition-colors hover:border-primary/40"
                  aria-label="ჩემი ანგარიში"
                >
                  <Avatar user={user} />
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56 rounded-xl">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.user_metadata?.["display_name"] || user.email || "ჩემი ანგარიში"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/sell">ახალი ნივთის დამატება</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my-items">ჩემი ნივთები</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorites">რჩეულები</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/messages" search={{}}>შეტყობინებები{unread > 0 ? ` (${unread})` : ""}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">პროფილი</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/wallet">ჩემი ბალანსი</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/payments">გადახდები</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">ადმინისტრირება</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive">
                  გამოსვლა
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-10 rounded-full px-3">
              <Link to="/auth" search={{}}>
                შესვლა
              </Link>
            </Button>
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full md:hidden" aria-label="მენიუ">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,85vw)] p-5">
              <SheetTitle className="font-sans text-lg font-semibold tracking-[0.08em]">MEORADI</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1 text-base" aria-label="მობილური ნავიგაცია" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMenuOpen(false); }}>
                <SellLink signedIn={!!user} className="mb-3 flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" aria-hidden /> გაყიდე
                </SellLink>
                <Link to="/" className={drawerLink} activeProps={{ className: drawerActive }} activeOptions={{ exact: true }}>მთავარი</Link>
                <Link to="/catalog" search={{}} className={drawerLink} activeProps={{ className: drawerActive }}>კატალოგი</Link>
                {user ? (
                  <>
                    <Link to="/my-items" className={drawerLink} activeProps={{ className: drawerActive }}>ჩემი ნივთები</Link>
                    <Link to="/favorites" className={drawerLink} activeProps={{ className: drawerActive }}>რჩეულები</Link>
                    <Link to="/messages" search={{}} className={drawerLink} activeProps={{ className: drawerActive }}>შეტყობინებები{unread > 0 ? ` (${unread})` : ""}</Link>
                    <Link to="/profile" className={drawerLink} activeProps={{ className: drawerActive }}>პროფილი</Link>
                    <Link to="/wallet" className={drawerLink} activeProps={{ className: drawerActive }}>ჩემი ბალანსი</Link>
                    {isAdmin && <Link to="/admin" className={drawerLink} activeProps={{ className: drawerActive }}>ადმინისტრირება</Link>}
                  </>
                ) : (
                  <Link to="/auth" search={{}} className={drawerLink}>შესვლა / რეგისტრაცია</Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

    </header>
  );
}

function Avatar({ user }: { user: { user_metadata?: Record<string, unknown> } }) {
  const src =
    typeof user.user_metadata?.["avatar_url"] === "string"
      ? user.user_metadata["avatar_url"]
      : null;
  return (
    <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-sage-soft text-xs font-medium text-sage-deep">
      {src ? (
        <img src={src} alt="" width={28} height={28} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>
          {String(
            user.user_metadata?.["display_name"] || user.user_metadata?.["email"] || "R",
          )
            .slice(0, 1)
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}

function SellLink({ signedIn, className, children }: { signedIn: boolean; className?: string; children: React.ReactNode }) {
  return signedIn ? (
    <Link to="/sell" className={className}>{children}</Link>
  ) : (
    <Link to="/auth" search={{ redirect: "/sell" }} className={className}>{children}</Link>
  );
}
