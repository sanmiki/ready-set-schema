import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-12">
        <div>
          <p className="font-sans text-xl font-semibold tracking-tight">MEORADI<span className="text-primary">.</span></p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            მეორადი ტანსაცმლის მარკეტი საქართველოში: იყიდე ნაკლებ ფასად ან გაყიდე ის, რასაც აღარ ატარებ.
          </p>
        </div>
        <nav aria-label="ძირითადი ბმულები" className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
          <Link to="/" className="transition hover:text-foreground">მთავარი</Link>
          <Link to="/catalog" search={{}} className="transition hover:text-foreground">კატალოგი</Link>
          <Link to="/sell" className="transition hover:text-foreground">გაყიდე ნივთი</Link>
          <Link to="/auth" className="transition hover:text-foreground">შესვლა</Link>
        </nav>
        <nav aria-label="იურიდიული ინფორმაცია" className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
          <Link to="/terms" className="transition hover:text-foreground">მომსახურების წესები</Link>
          <Link to="/privacy" className="transition hover:text-foreground">კონფიდენციალურობა</Link>
          <Link to="/refunds" className="transition hover:text-foreground">თანხის დაბრუნება</Link>
          <Link to="/listing-rules" className="transition hover:text-foreground">განცხადებების წესები</Link>
          <Link to="/contact" className="transition hover:text-foreground">კონტაქტი</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} MEORADI · ფასები ლარში (₾) · იურიდიული ტექსტები — მონახაზი
        </div>
      </div>
    </footer>
  );
}
