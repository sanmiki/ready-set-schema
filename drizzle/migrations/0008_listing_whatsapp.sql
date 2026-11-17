ALTER TABLE public.listing_contacts ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.listing_public_whatsapp(_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lc.phone FROM public.listing_contacts lc
  JOIN public.products p ON p.id = lc.product_id
  WHERE lc.product_id = _product_id AND lc.is_public AND lc.whatsapp_enabled AND p.status = 'active'
$$;
REVOKE ALL ON FUNCTION public.listing_public_whatsapp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_public_whatsapp(uuid) TO anon, authenticated;