DROP POLICY IF EXISTS "promotion prices are public" ON public.promotion_prices;
REVOKE SELECT ON public.promotion_prices FROM anon;
CREATE POLICY "signed-in users read promotion prices" ON public.promotion_prices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);