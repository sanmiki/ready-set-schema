import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { CURRENT_LEGAL_VERSION } from "@/lib/legal";
import { LEGAL_UPDATE_DATE, type LegalDocumentContent, type LegalPath } from "@/lib/legal-content";

const SITE_URL = "https://ready-set-schema.lovable.app";

export function legalHead(document: LegalDocumentContent, path: LegalPath) {
  const url = `${SITE_URL}${path}`;
  return {
    meta: [
      { title: `${document.title} · MEORADI` },
      { name: "description", content: document.description },
      { property: "og:title", content: `${document.title} · MEORADI` },
      { property: "og:description", content: document.description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function LegalPage({ document }: { document: LegalDocumentContent }) {
  return (
    <article className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          მთავარ გვერდზე დაბრუნება
        </Link>

        <div className="mt-6 rounded-2xl border border-primary/30 bg-sage-soft p-4 text-sm text-sage-deep">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            მონახაზი — საჭიროა საქართველოს კანონმდებლობის სპეციალისტის მიმოხილვა ოფიციალურ გამოქვეყნებამდე.
          </p>
          <p className="mt-1 pl-6 text-xs">ვერსია: {CURRENT_LEGAL_VERSION} · ბოლო განახლება: {LEGAL_UPDATE_DATE}</p>
        </div>

        <header className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">MEORADI · იურიდიული ინფორმაცია</p>
          <h1 className="mt-3 text-3xl leading-tight md:text-4xl">{document.title}</h1>
          <p className="mt-4 text-base leading-8 text-muted-foreground">{document.intro}</p>
        </header>

        <div className="mt-10 space-y-5">
          {document.sections.map((section, index) => (
            <section key={section.title} className="surface p-5 sm:p-7" aria-labelledby={`legal-section-${index}`}>
              <h2 id={`legal-section-${index}`} className="text-xl leading-snug">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground">{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.externalLinks?.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {link.label}
                </a>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm leading-7 text-muted-foreground">
          <p>კითხვა, საჩივარი ან მოთხოვნა გაქვთ?</p>
          <Link to="/contact" className="mt-2 inline-flex font-medium text-primary underline-offset-4 hover:underline">
            საკონტაქტო ინფორმაცია
          </Link>
        </footer>
      </div>
    </article>
  );
}
