import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, legalHead } from "@/components/site/LegalPage";
import { LEGAL_CONTENT } from "@/lib/legal-content";

const document = LEGAL_CONTENT["/refunds"];

export const Route = createFileRoute("/refunds")({
  head: () => legalHead(document, "/refunds"),
  component: RefundsPage,
});

function RefundsPage() {
  return <LegalPage document={document} />;
}
