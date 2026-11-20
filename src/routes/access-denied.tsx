import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/access-denied")({
  head: () => ({
    meta: [
      { title: "წვდომა შეზღუდულია · MEORADI" },
      { name: "description", content: "ამ გვერდის ნახვის უფლება არ გაქვთ." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "წვდომა შეზღუდულია · MEORADI" },
      { property: "og:description", content: "ამ გვერდის ნახვის უფლება არ გაქვთ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <ShieldOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl">წვდომა შეზღუდულია</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">ამ გვერდის ნახვა მხოლოდ MEORADI-ის ადმინისტრატორებს შეუძლიათ.</p>
      <Link to="/" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">მთავარ გვერდზე</Link>
    </div>
  ),
});
