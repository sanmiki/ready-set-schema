ALTER TABLE public.products ADD COLUMN IF NOT EXISTS neighborhood text CHECK (neighborhood IS NULL OR char_length(neighborhood) <= 80);

CREATE TABLE public.seller_contacts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^\+995[0-9]{9}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_contacts TO authenticated;
GRANT ALL ON public.seller_contacts TO service_role;
ALTER TABLE public.seller_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own phone" ON public.seller_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner adds own phone" ON public.seller_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates own phone" ON public.seller_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner deletes own phone" ON public.seller_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.listing_contacts (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^\+995[0-9]{9}$'),
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO authenticated;
GRANT ALL ON public.listing_contacts TO service_role;
ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing owner reads contact" ON public.listing_contacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "listing owner adds contact" ON public.listing_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "listing owner updates contact" ON public.listing_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "listing owner deletes contact" ON public.listing_contacts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.listing_has_public_phone(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.listing_contacts c JOIN public.products p ON p.id = c.product_id
    WHERE c.product_id = _product_id AND c.is_public AND p.status = 'active');
$$;
CREATE OR REPLACE FUNCTION public.listing_public_phone(_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.phone FROM public.listing_contacts c JOIN public.products p ON p.id = c.product_id
    WHERE c.product_id = _product_id AND c.is_public AND p.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.listing_has_public_phone(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listing_public_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_has_public_phone(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listing_public_phone(uuid) TO anon, authenticated;