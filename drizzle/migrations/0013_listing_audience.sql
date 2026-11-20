ALTER TABLE public.products ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE public.products ADD CONSTRAINT products_audience_check CHECK (audience IS NULL OR audience IN ('men','women','kids'));
CREATE INDEX IF NOT EXISTS products_audience_idx ON public.products (audience);