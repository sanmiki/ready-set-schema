import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, legalHead } from "@/components/site/LegalPage";
import { LEGAL_CONTENT } from "@/lib/legal-content";

const document = LEGAL_CONTENT["/contact"];

export const Route = createFileRoute("/contact")({
  head: () => legalHead(document, "/contact"),
  component: ContactPage,
});

function ContactPage() {
  return <LegalPage document={document} />;
}
