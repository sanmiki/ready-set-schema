import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, legalHead } from "@/components/site/LegalPage";
import { LEGAL_CONTENT } from "@/lib/legal-content";

const document = LEGAL_CONTENT["/listing-rules"];

export const Route = createFileRoute("/listing-rules")({
  head: () => legalHead(document, "/listing-rules"),
  component: ListingRulesPage,
});

function ListingRulesPage() {
  return <LegalPage document={document} />;
}
