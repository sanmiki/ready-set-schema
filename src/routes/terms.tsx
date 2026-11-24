import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, legalHead } from "@/components/site/LegalPage";
import { LEGAL_CONTENT } from "@/lib/legal-content";

const document = LEGAL_CONTENT["/terms"];

export const Route = createFileRoute("/terms")({
  head: () => legalHead(document, "/terms"),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage document={document} />;
}
