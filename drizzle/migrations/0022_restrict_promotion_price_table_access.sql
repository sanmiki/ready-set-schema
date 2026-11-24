DROP POLICY IF EXISTS "signed-in users read promotion prices" ON public.promotion_prices;

CREATE POLICY "admins read promotion prices"
ON public.promotion_prices
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.promotion_price_list()
RETURNS TABLE(code text, tetri integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.code, pp.tetri
  FROM public.promotion_prices pp
  ORDER BY pp.code;
$$;

REVOKE ALL ON FUNCTION public.promotion_price_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promotion_price_list() TO authenticated;