import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, legalHead } from "@/components/site/LegalPage";
import { LEGAL_CONTENT } from "@/lib/legal-content";

const document = LEGAL_CONTENT["/privacy"];

export const Route = createFileRoute("/privacy")({
  head: () => legalHead(document, "/privacy"),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage document={document} />;
}
