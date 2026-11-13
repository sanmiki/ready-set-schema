import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { firstMessage, passwordSchema } from "@/lib/validation";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "პაროლის აღდგენა · ReWear" },
      { name: "description", content: "დააყენეთ ახალი პაროლი ReWear-ის ანგარიშისთვის." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "პაროლის აღდგენა · ReWear" },
      { property: "og:description", content: "ReWear — მეორადი მოდა საქართველოში." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(!!data.session);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(firstMessage(parsed.error));
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) {
        setError("პაროლის შეცვლა ვერ მოხერხდა — სცადეთ აღდგენის ბმული ხელახლა.");
        return;
      }
      toast("პაროლი შეიცვალა");
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="container-page py-16 text-center text-sm text-muted-foreground">
        ვამოწმებთ ბმულს…
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="container-page flex justify-center py-16">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl">აღდგენის ბმული ვარგადაა</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ბმული ერთჯერადია და დროში შეზღუდული. სთხოვეთ ახალი.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/auth" search={{ mode: "signin" }}>
              პაროლის აღდგენა
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 md:p-8">
        <h1 className="text-2xl">ახალი პაროლი</h1>
        <p className="mt-1 text-sm text-muted-foreground">აირჩიეთ ახალი პაროლი.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="new_password">პაროლი</Label>
            <Input
              id="new_password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">გამეორება</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
            პაროლის შეცვლა
          </Button>
        </form>
      </div>
    </div>
  );
}
