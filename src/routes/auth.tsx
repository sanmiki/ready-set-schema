import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GoogleIcon } from "@/components/site/GoogleIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { firstMessage, signInSchema, signUpSchema } from "@/lib/validation";

type AuthSearch = {
  mode?: "signin" | "signup" | undefined;
  redirect?: string | undefined;
};

// Only same-origin paths the app actually owns may be a sign-in destination.
const ALLOWED_TARGETS = ["/sell", "/my-items", "/profile", "/favorites", "/catalog", "/"] as const;
type AllowedTarget = (typeof ALLOWED_TARGETS)[number];

function allowedTarget(value: string | undefined): AllowedTarget | undefined {
  return ALLOWED_TARGETS.find((target) => target === value);
}

const providerButtonStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #747775",
  color: "#1F1F1F",
} as const;

export const Route = createFileRoute("/auth")({
  validateSearch: (raw): AuthSearch => ({
    mode: raw["mode"] === "signup" || raw["mode"] === "signin" ? raw["mode"] : undefined,
    redirect:
      typeof raw["redirect"] === "string" &&
      raw["redirect"].startsWith("/") &&
      !raw["redirect"].startsWith("//")
        ? raw["redirect"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "შესვლა · ReWear" },
      {
        name: "description",
        content: "შედით ReWear-ზე, რომ ნივთები გამოაქვეყნოთ ან პროფილი შეავსოთ.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "შესვლა · ReWear" },
      { property: "og:description", content: "ReWear — მეორადი მოდა საქართველოში." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { user, ready } = useSession();

  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  function finish() {
    const target = allowedTarget(search.redirect);
    navigate({ to: target ?? "/", replace: true });
  }

  useEffect(() => {
    if (ready && user) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed =
      mode === "signup"
        ? signUpSchema.safeParse({ email, password, display_name: displayName })
        : signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const message = firstMessage(parsed.error);
      setError(message);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signInError) {
          setError(translateAuthError(signInError.message));
          return;
        }
        finish();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name:
              "display_name" in parsed.data ? (parsed.data.display_name ?? "") : "",
          },
        },
      });

      if (signUpError) {
        setError(translateAuthError(signUpError.message));
        return;
      }

      if (!data.session) {
        toast("გამოგზავნილია დადასტურების წერილი — შეამოწმეთ ელფოსტა.");
        return;
      }
      finish();
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "lovable") {
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(translateAuthError(result.error.message));
      return;
    }
    if (result.redirected) return;
    finish();
  }

  async function handleForgot(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }
    toast("პაროლის აღდგენის წერილი გამოგზავნილია.");
    setForgotOpen(false);
  }

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 md:p-8">
        <h1 className="text-2xl">{mode === "signin" ? "შესვლა" : "რეგისტრაცია"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "შედით, რომ ნივთები გამოაქვეყნოთ."
            : "შექმენით ანგარიში — უფასოა."}
        </p>

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-full text-sm font-medium"
            style={providerButtonStyle}
            onClick={() => void handleOAuth("google")}
          >
            <GoogleIcon />
            <span className="ml-2.5">გაგრძელება Google-ით</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-full text-sm font-medium"
            style={providerButtonStyle}
            onClick={() => void handleOAuth("lovable")}
          >
            <span className="mr-2 text-base leading-none">◆</span>
            <span>გაგრძელება Lovable-ით</span>
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>ან ელფოსტით</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <div>
              <Label htmlFor="display_name">სახელი</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1.5"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">ელფოსტა</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5"
              autoComplete="email"
            />
          </div>

          <div>
            <Label htmlFor="password">პაროლი</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" && (
              <p className="mt-1 text-xs text-muted-foreground">მინიმუმ 8 სიმბოლო.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
            {mode === "signin" ? "შესვლა" : "რეგისტრაცია"}
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "არ გაქვთ ანგარიში? შექმენით" : "უკვე გაქვთ ანგარიში? შედით"}
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setForgotOpen((open) => !open)}
          >
            გაგავიწყდათ პაროლი?
          </button>
        </div>

        {forgotOpen && (
          <form onSubmit={handleForgot} className="mt-4 space-y-3 rounded-2xl bg-muted p-4">
            <Label htmlFor="forgot_email">ელფოსტა</Label>
            <Input
              id="forgot_email"
              type="email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              className="mt-1.5"
            />
            <Button type="submit" variant="outline" className="w-full rounded-full">
              აღდგენის წერილის გაგზავნა
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function translateAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "ელფოსტა ან პაროლი არასწორია.";
  if (text.includes("email not confirmed")) return "ელფოსტა დადასტურებული არ არის.";
  if (text.includes("already registered")) return "ეს ელფოსტა უკვე დარეგისტრირებულია.";
  if (text.includes("rate limit") || text.includes("over_email_send_rate_limit"))
    return "ძალიან ბევრი მცდელობა — სცადეთ მოგვიანებით.";
  if (text.includes("password")) return "პაროლი მოთხოვნებს ვერ აკმაყოფილებს.";
  return message;
}
