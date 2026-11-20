ALTER TABLE public.products DROP CONSTRAINT products_audience_check;
UPDATE public.products p SET audience = COALESCE(r.slug, c.slug)
FROM public.categories c LEFT JOIN public.categories r ON r.id = c.parent_id
WHERE p.category_id = c.id AND p.audience IS NULL
  AND COALESCE(r.slug, c.slug) IN ('men','women','kids','unisex');
ALTER TABLE public.products ADD CONSTRAINT products_audience_check CHECK (audience IS NULL OR audience IN ('men','women','kids','unisex'));