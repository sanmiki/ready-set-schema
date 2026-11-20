import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LISTING_CATEGORIES, searchCategories, type ListingCategory } from "@/lib/listing-categories";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  invalidLabel?: string | null;
  className?: string;
};

export function CategoryCombobox({ id, value, onChange, invalidLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { matches, suggestions } = useMemo(() => searchCategories(query), [query]);
  const items: ListingCategory[] = matches.length ? matches : suggestions;
  const selected = LISTING_CATEGORIES.find((c) => c.slug === value);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = LISTING_CATEGORIES.findIndex((c) => c.slug === value);
    setActive(i >= 0 ? i : 0);
  }, [open, value]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (c: ListingCategory) => {
    onChange(c.slug);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) pick(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  const listId = `${id}-list`;
  const renderItem = (c: ListingCategory, i: number) => (
    <div
      key={c.slug}
      id={`${id}-opt-${c.slug}`}
      role="option"
      aria-selected={c.slug === value}
      data-index={i}
      onMouseEnter={() => setActive(i)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => pick(c)}
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors duration-200",
        i === active ? "bg-secondary text-foreground" : "text-foreground/85",
        c.slug === value && "font-medium",
      )}
    >
      {c.name}
      {c.slug === value && <Check className="h-4 w-4 text-primary" />}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3.5 text-left text-sm transition-colors duration-200 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected?.name ?? invalidLabel ?? "აირჩიეთ კატეგორია"}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-xl p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="მოძებნე კატეგორია..."
            aria-label="მოძებნე კატეგორია"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${id}-opt-${items[active].slug}` : undefined}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors duration-200 focus:border-primary"
          />
        </div>
        <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain">
          {matches.length > 0 && matches.map(renderItem)}
          {!matches.length && suggestions.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-1.5 text-xs text-muted-foreground">შესაძლოა გულისხმობდი:</p>
              {suggestions.map(renderItem)}
            </>
          )}
          {!items.length && <p className="px-3 py-4 text-center text-sm text-muted-foreground">კატეგორია ვერ მოიძებნა</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
