import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

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
  "rounded-full px-3 py-2 text-muted-foreground transition hover:bg-sage-soft hover:text-foreground";
const activeNavClass = "rounded-full px-3 py-2 bg-sage-soft text-foreground";

export function SiteHeader() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl tracking-tight">ReWear</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">მეორადი მოდა</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className={navClass} activeProps={{ className: activeNavClass }}>
            მთავარი
          </Link>
          <Link
            to="/catalog"
            search={{}}
            className={navClass}
            activeProps={{ className: activeNavClass }}
          >
            კატალოგი
          </Link>
          {user ? (
            <Link to="/sell" className={navClass}>
              გაყიდე ნივთი
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: "/sell" }}
              className={navClass}
            >
              გაყიდე ნივთი
            </Link>
          )}
          {user && (
            <Link to="/my-items" className={navClass} activeProps={{ className: activeNavClass }}>
              ჩემი ნივთები
            </Link>
          )}
        </nav>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm transition hover:border-sage"
              >
                <Avatar user={user} />
                <span className="max-w-[10rem] truncate">
                  {user.user_metadata?.["display_name"] || user.email || "პროფილი"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel>ჩემი ანგარიში</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">პროფილი</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/favorites">რჩეულები</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-items">ჩემი ნივთები</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/sell">ახალი ნივთის დამატება</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive">
                გამოსვლა
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/auth" search={{}}>
                შესვლა
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/auth" search={{ mode: "signup" }}>
                რეგისტრაცია
              </Link>
            </Button>
          </div>
        )}
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
