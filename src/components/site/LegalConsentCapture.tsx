import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useSession } from "@/hooks/useSession";
import { recordLegalAcceptance } from "@/lib/legal.functions";

const PENDING_KEY = "meoradi.pendingRegistrationConsent";

type PendingConsent = { context: "registration"; contextKey: string };

export function prepareRegistrationConsent(): string {
  const contextKey = crypto.randomUUID();
  const pending: PendingConsent = { context: "registration", contextKey };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return contextKey;
}

export function clearPendingRegistrationConsent() {
  sessionStorage.removeItem(PENDING_KEY);
}

function pendingConsent(): PendingConsent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as Partial<PendingConsent> | null;
    return value?.context === "registration" && typeof value.contextKey === "string" && value.contextKey.length >= 8
      ? { context: "registration", contextKey: value.contextKey }
      : null;
  } catch {
    return null;
  }
}

export function LegalConsentCapture() {
  const { user, ready } = useSession();
  const record = useServerFn(recordLegalAcceptance);
  const running = useRef(false);

  useEffect(() => {
    if (!ready || !user || running.current) return;
    const pending = pendingConsent();
    if (!pending) return;
    running.current = true;
    void record({ data: pending }).then((result) => {
      if (result.ok) {
        sessionStorage.removeItem(PENDING_KEY);
      } else {
        toast.error(result.message);
      }
    }).catch(() => {
      toast.error("წესების მიღების ჩანაწერი ვერ შეინახა. განაახლეთ გვერდი.");
    }).finally(() => {
      running.current = false;
    });
  }, [ready, user, record]);

  return null;
}
