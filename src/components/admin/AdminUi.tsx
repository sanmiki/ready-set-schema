import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-sans text-2xl font-semibold tracking-tight">{title}</h1>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </header>
  );
}

export function StateBox({ state, onRetry, empty }: { state: "loading" | "error" | "empty"; onRetry?: () => void; empty?: string }) {
  return (
    <div className="surface flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
      {state === "loading" && <Loader2 className="h-5 w-5 animate-spin" aria-label="იტვირთება" />}
      {state === "error" && (
        <>
          <p>მონაცემები ვერ ჩაიტვირთა.</p>
          {onRetry && <Button variant="outline" size="sm" className="rounded-full" onClick={onRetry}>თავიდან ცდა</Button>}
        </>
      )}
      {state === "empty" && <p>{empty ?? "ჩანაწერები ჯერ არ არის."}</p>}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "sage" | "warn" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "muted" && "bg-muted text-muted-foreground",
      tone === "sage" && "bg-sage-soft text-sage-deep",
      tone === "warn" && "bg-destructive/10 text-destructive",
      tone === "dark" && "bg-foreground text-background")}>
      {children}
    </span>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>სულ: {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>წინა</Button>
        <span>{page + 1} / {pages}</span>
        <Button variant="ghost" size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>შემდეგი</Button>
      </div>
    </div>
  );
}

export function Confirm({ trigger, title, description, action, onConfirm, destructive }: {
  trigger: React.ReactNode; title: string; description: string; action: string; onConfirm: () => void; destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>გაუქმება</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const tableWrap = "surface overflow-x-auto";
export const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground";
export const td = "px-4 py-3 align-top";
export const inputCls = "h-10 rounded-xl border border-input bg-card px-3 text-sm outline-none transition-colors duration-200 focus-visible:border-primary";
