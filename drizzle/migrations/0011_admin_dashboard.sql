CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

CREATE OR REPLACE FUNCTION public.require_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END $$;

-- Suspensions
CREATE TABLE public.account_suspensions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  suspended_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_suspensions TO authenticated;
GRANT ALL ON public.account_suspensions TO service_role;
ALTER TABLE public.account_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin reads suspension" ON public.account_suspensions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.is_suspended(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_suspensions WHERE user_id = _uid)
$$;
CREATE POLICY "suspended users cannot list" ON public.products AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_suspended(auth.uid()));
CREATE POLICY "suspended users cannot message" ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_suspended(auth.uid()));

-- Listing moderation
CREATE TABLE public.listing_moderation (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('hidden','prohibited')),
  reason text NOT NULL DEFAULT '',
  previous_status public.product_status NOT NULL,
  moderated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_moderation TO authenticated;
GRANT ALL ON public.listing_moderation TO service_role;
ALTER TABLE public.listing_moderation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin reads moderation" ON public.listing_moderation FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_listing_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'draft' AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'listing must be published through publish_listing' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status <> 'draft' AND EXISTS (SELECT 1 FROM public.listing_moderation WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'listing is hidden by moderation' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- Reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('suspicious','prohibited','misleading','fraud','inappropriate')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','under_review','resolved','dismissed')),
  admin_decision text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR reported_user_id IS NOT NULL)
);
CREATE INDEX reports_status_idx ON public.reports(status, created_at DESC);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporters read own reports" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());
CREATE POLICY "users file reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'new' AND admin_decision IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
              AND (reported_user_id IS NULL OR reported_user_id <> auth.uid()));

-- Platform settings (single row)
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  listing_fee_tetri integer NOT NULL DEFAULT 50 CHECK (listing_fee_tetri BETWEEN 0 AND 100000),
  first_listing_free boolean NOT NULL DEFAULT true,
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  moderation_note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_settings(id) VALUES (true);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings are public" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.listing_fee_quote() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN s.first_listing_free AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = auth.uid())
              THEN 0 ELSE s.listing_fee_tetri END
  FROM public.platform_settings s WHERE s.id;
$$;

CREATE OR REPLACE FUNCTION public.publish_listing(_product_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bal integer; fee integer; free_first boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.is_suspended(uid) THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.products WHERE id = _product_id AND seller_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.listing_moderation WHERE product_id = _product_id) THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  SELECT listing_fee_tetri, first_listing_free INTO fee, free_first FROM public.platform_settings WHERE id;

  IF NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = _product_id) THEN
    IF (free_first AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = uid)) OR fee = 0 THEN
      INSERT INTO public.listing_publications(product_id,user_id,method,amount_tetri) VALUES (_product_id, uid, 'free', 0);
    ELSE
      SELECT COALESCE(SUM(amount_tetri),0) INTO bal FROM public.wallet_transactions WHERE user_id = uid;
      IF bal < fee THEN RETURN 'insufficient_balance'; END IF;
      INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,idempotency_key)
        VALUES (uid,'listing_charge',-fee,_product_id,'listing:' || _product_id::text);
      INSERT INTO public.listing_publications(product_id,user_id,method,amount_tetri) VALUES (_product_id, uid, 'wallet', fee);
    END IF;
  END IF;

  UPDATE public.products SET status = 'active' WHERE id = _product_id;
  RETURN 'published';
END $$;

-- ===== Admin RPCs (each checks the role itself) =====
CREATE OR REPLACE FUNCTION public.admin_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'suspended', (SELECT count(*) FROM public.account_suspensions),
    'listings', (SELECT count(*) FROM public.products),
    'active', (SELECT count(*) FROM public.products WHERE status = 'active'),
    'sold', (SELECT count(*) FROM public.products WHERE status = 'sold'),
    'hidden', (SELECT count(*) FROM public.listing_moderation),
    'open_reports', (SELECT count(*) FROM public.reports WHERE status IN ('new','under_review')),
    'promotions', (SELECT count(*) FROM public.listing_promotions),
    'active_promotions', (SELECT count(*) FROM public.listing_promotions WHERE ends_at > now()),
    'promotion_tetri', (SELECT COALESCE(-SUM(amount_tetri),0) FROM public.wallet_transactions WHERE kind = 'promotion_charge'),
    'fee_tetri', (SELECT COALESCE(-SUM(amount_tetri),0) FROM public.wallet_transactions WHERE kind = 'listing_charge'),
    'paid_payments', (SELECT count(*) FROM public.payments WHERE status = 'paid'),
    'paid_tetri', (SELECT COALESCE(SUM(amount_tetri),0) FROM public.payments WHERE status = 'paid'),
    'signups_30d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'n', n) ORDER BY d), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date d, count(*) n FROM public.profiles WHERE created_at > now() - interval '30 days' GROUP BY 1) x)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_users(_q text, _status text, _limit int, _offset int)
RETURNS TABLE(id uuid, username text, display_name text, city text, created_at timestamptz, listings bigint, active_listings bigint, reports bigint, suspended boolean, suspension_reason text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.city, p.created_at,
    (SELECT count(*) FROM public.products x WHERE x.seller_id = p.id),
    (SELECT count(*) FROM public.products x WHERE x.seller_id = p.id AND x.status = 'active'),
    (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = p.id),
    s.user_id IS NOT NULL, s.reason,
    count(*) OVER ()
  FROM public.profiles p LEFT JOIN public.account_suspensions s ON s.user_id = p.id
  WHERE (_q IS NULL OR _q = '' OR p.username ILIKE '%' || _q || '%' OR p.display_name ILIKE '%' || _q || '%')
    AND (_status IS NULL OR _status = 'all' OR (_status = 'suspended' AND s.user_id IS NOT NULL) OR (_status = 'active' AND s.user_id IS NULL)
         OR (_status = 'reported' AND EXISTS (SELECT 1 FROM public.reports r WHERE r.reported_user_id = p.id AND r.status IN ('new','under_review'))))
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(_user_id uuid, _suspend boolean, _reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid := public.require_admin();
BEGIN
  IF _user_id = aid THEN RETURN 'self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RETURN 'not_found'; END IF;
  IF _suspend THEN
    INSERT INTO public.account_suspensions(user_id, reason, suspended_by) VALUES (_user_id, left(coalesce(_reason,''),500), aid)
      ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason;
  ELSE
    DELETE FROM public.account_suspensions WHERE user_id = _user_id;
  END IF;
  INSERT INTO public.admin_audit_log(admin_id, action, target_type, target_id, meta)
    VALUES (aid, CASE WHEN _suspend THEN 'user.suspend' ELSE 'user.unsuspend' END, 'user', _user_id::text, jsonb_build_object('reason', left(coalesce(_reason,''),500)));
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.admin_listings(_q text, _status text, _category uuid, _since timestamptz, _limit int, _offset int)
RETURNS TABLE(id uuid, title text, price numeric, status public.product_status, created_at timestamptz, seller_id uuid, seller_username text, category_name text, image_path text, moderation text, moderation_reason text, reports bigint, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT p.id, p.title, p.price, p.status, p.created_at, p.seller_id, pr.username, c.name,
    (SELECT i.storage_path FROM public.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1),
    m.kind, m.reason,
    (SELECT count(*) FROM public.reports r WHERE r.product_id = p.id),
    count(*) OVER ()
  FROM public.products p
  JOIN public.profiles pr ON pr.id = p.seller_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN public.listing_moderation m ON m.product_id = p.id
  WHERE (_q IS NULL OR _q = '' OR p.title ILIKE '%' || _q || '%' OR pr.username ILIKE '%' || _q || '%')
    AND (_category IS NULL OR p.category_id = _category OR c.parent_id = _category)
    AND (_since IS NULL OR p.created_at >= _since)
    AND (_status IS NULL OR _status = 'all'
         OR (_status = 'hidden' AND m.product_id IS NOT NULL)
         OR (_status = 'reported' AND EXISTS (SELECT 1 FROM public.reports r WHERE r.product_id = p.id AND r.status IN ('new','under_review')))
         OR (_status IN ('draft','active','reserved','sold') AND p.status::text = _status AND m.product_id IS NULL))
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_moderate_listing(_product_id uuid, _action text, _reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid := public.require_admin(); cur public.product_status; prev public.product_status;
BEGIN
  SELECT status INTO cur FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _action IN ('hide','prohibit') THEN
    INSERT INTO public.listing_moderation(product_id, kind, reason, previous_status, moderated_by)
      VALUES (_product_id, CASE WHEN _action = 'hide' THEN 'hidden' ELSE 'prohibited' END, left(coalesce(_reason,''),500), cur, aid)
      ON CONFLICT (product_id) DO UPDATE SET kind = EXCLUDED.kind, reason = EXCLUDED.reason;
    UPDATE public.products SET status = 'draft' WHERE id = _product_id;
  ELSIF _action = 'restore' THEN
    DELETE FROM public.listing_moderation WHERE product_id = _product_id RETURNING previous_status INTO prev;
    IF prev IS NULL THEN RETURN 'not_found'; END IF;
    UPDATE public.products SET status = prev WHERE id = _product_id;
  ELSE
    RETURN 'invalid';
  END IF;
  INSERT INTO public.admin_audit_log(admin_id, action, target_type, target_id, meta)
    VALUES (aid, 'listing.' || _action, 'listing', _product_id::text, jsonb_build_object('reason', left(coalesce(_reason,''),500), 'status_before', cur));
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.admin_reports(_status text, _limit int, _offset int)
RETURNS TABLE(id uuid, reason text, details text, status text, admin_decision text, created_at timestamptz, reviewed_at timestamptz, reporter_username text, product_id uuid, product_title text, reported_user_id uuid, reported_username text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT r.id, r.reason, r.details, r.status, r.admin_decision, r.created_at, r.reviewed_at, rp.username,
    r.product_id, p.title, r.reported_user_id, up.username, count(*) OVER ()
  FROM public.reports r
  JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles up ON up.id = r.reported_user_id
  WHERE _status IS NULL OR _status = 'all' OR r.status = _status
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_report(_report_id uuid, _status text, _decision text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid := public.require_admin(); before text;
BEGIN
  IF _status NOT IN ('new','under_review','resolved','dismissed') THEN RETURN 'invalid'; END IF;
  SELECT status INTO before FROM public.reports WHERE id = _report_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  UPDATE public.reports SET status = _status, admin_decision = NULLIF(left(coalesce(_decision,''),1000),''), reviewed_by = aid, reviewed_at = now() WHERE id = _report_id;
  INSERT INTO public.admin_audit_log(admin_id, action, target_type, target_id, meta)
    VALUES (aid, 'report.update', 'report', _report_id::text, jsonb_build_object('from', before, 'to', _status));
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.admin_promotions(_limit int, _offset int)
RETURNS TABLE(id uuid, product_id uuid, product_title text, seller_username text, tier text, days int, highlight boolean, bump_mode text, amount_tetri int, method text, paid boolean, starts_at timestamptz, ends_at timestamptz, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT lp.id, lp.product_id, p.title, pr.username, lp.tier, lp.days, lp.highlight, lp.bump_mode, lp.amount_tetri, lp.method,
    EXISTS (SELECT 1 FROM public.wallet_transactions w WHERE w.idempotency_key = lp.idempotency_key AND w.kind = 'promotion_charge') OR lp.amount_tetri = 0,
    lp.starts_at, lp.ends_at, count(*) OVER ()
  FROM public.listing_promotions lp
  JOIN public.products p ON p.id = lp.product_id
  JOIN public.profiles pr ON pr.id = lp.user_id
  ORDER BY lp.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_finance(_limit int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'payments', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
       SELECT py.id, py.purpose, py.amount_tetri, py.status, py.provider, py.created_at, pr.username
       FROM public.payments py JOIN public.profiles pr ON pr.id = py.user_id ORDER BY py.created_at DESC LIMIT LEAST(_limit,200)) x),
    'ledger', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
       SELECT w.id, w.kind, w.amount_tetri, w.created_at, pr.username, w.product_id
       FROM public.wallet_transactions w JOIN public.profiles pr ON pr.id = w.user_id ORDER BY w.created_at DESC LIMIT LEAST(_limit,200)) x)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(_fee int, _first_free boolean, _email text, _phone text, _note text, _prices jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid := public.require_admin(); before jsonb; before_prices jsonb; k text; v int;
BEGIN
  IF _fee IS NULL OR _fee < 0 OR _fee > 100000 THEN RETURN 'invalid'; END IF;
  SELECT to_jsonb(s) INTO before FROM public.platform_settings s WHERE id;
  SELECT jsonb_object_agg(code, tetri) INTO before_prices FROM public.promotion_prices;
  IF _prices IS NOT NULL THEN
    FOR k, v IN SELECT key, (value)::int FROM jsonb_each_text(_prices) LOOP
      IF k NOT IN ('vip','vip_plus','super_vip','highlight','bump') OR v < 0 OR v > 1000000 THEN RETURN 'invalid'; END IF;
    END LOOP;
    FOR k, v IN SELECT key, (value)::int FROM jsonb_each_text(_prices) LOOP
      UPDATE public.promotion_prices SET tetri = v, updated_at = now() WHERE code = k;
    END LOOP;
  END IF;
  UPDATE public.platform_settings SET listing_fee_tetri = _fee, first_listing_free = coalesce(_first_free, true),
    contact_email = left(coalesce(_email,''),200), contact_phone = left(coalesce(_phone,''),50),
    moderation_note = left(coalesce(_note,''),2000), updated_at = now() WHERE id;
  INSERT INTO public.admin_audit_log(admin_id, action, target_type, target_id, meta)
    VALUES (aid, 'settings.update', 'settings', 'platform', jsonb_build_object('before', before - 'id' - 'updated_at', 'prices_before', before_prices, 'prices_after', _prices,
      'after', jsonb_build_object('listing_fee_tetri', _fee, 'first_listing_free', _first_free)));
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.require_admin(), public.admin_stats(), public.admin_users(text,text,int,int), public.admin_set_suspension(uuid,boolean,text),
  public.admin_listings(text,text,uuid,timestamptz,int,int), public.admin_moderate_listing(uuid,text,text), public.admin_reports(text,int,int),
  public.admin_update_report(uuid,text,text), public.admin_promotions(int,int), public.admin_finance(int),
  public.admin_update_settings(int,boolean,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_admin(), public.admin_stats(), public.admin_users(text,text,int,int), public.admin_set_suspension(uuid,boolean,text),
  public.admin_listings(text,text,uuid,timestamptz,int,int), public.admin_moderate_listing(uuid,text,text), public.admin_reports(text,int,int),
  public.admin_update_report(uuid,text,text), public.admin_promotions(int,int), public.admin_finance(int),
  public.admin_update_settings(int,boolean,text,text,text,jsonb) TO authenticated;