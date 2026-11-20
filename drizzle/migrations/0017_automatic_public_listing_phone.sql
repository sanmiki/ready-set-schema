CREATE OR REPLACE FUNCTION public.listing_has_public_phone(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listing_contacts c
    JOIN public.products p ON p.id = c.product_id
    WHERE c.product_id = _product_id
      AND c.phone IS NOT NULL
      AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.listing_public_phone(_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.phone
  FROM public.listing_contacts c
  JOIN public.products p ON p.id = c.product_id
  WHERE c.product_id = _product_id
    AND c.phone IS NOT NULL
    AND p.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.listing_public_whatsapp(_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lc.phone
  FROM public.listing_contacts lc
  JOIN public.products p ON p.id = lc.product_id
  WHERE lc.product_id = _product_id
    AND lc.phone IS NOT NULL
    AND lc.whatsapp_enabled
    AND p.status = 'active';
$$;

COMMENT ON COLUMN public.listing_contacts.is_public IS 'DEPRECATED: active listing phones are public automatically; retained only for historical data.';