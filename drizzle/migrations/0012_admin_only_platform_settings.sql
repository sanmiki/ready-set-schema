DROP POLICY "settings are public" ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon;
CREATE POLICY "admins read settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_admin());