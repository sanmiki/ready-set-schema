import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-sans text-xl font-semibold tracking-tight">მეორადი<span className="text-primary">.</span></p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            მეორადი ტანსაცმლის მარკეტი საქართველოში: იყიდე ნაკლებ ფასად ან გაყიდე ის, რასაც აღარ ატარებ.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/" className="transition hover:text-foreground">მთავარი</Link>
          <Link to="/catalog" search={{}} className="transition hover:text-foreground">კატალოგი</Link>
          <Link to="/sell" className="transition hover:text-foreground">გაყიდე ნივთი</Link>
          <Link to="/auth" className="transition hover:text-foreground">შესვლა</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} მეორადი (MEORADI) · ფასები ლარში (₾)
        </div>
      </div>
    </footer>
  );
}
