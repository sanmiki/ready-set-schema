ALTER TYPE public.wallet_tx_kind ADD VALUE IF NOT EXISTS 'promotion_charge';

CREATE TABLE public.promotion_prices (
  code text PRIMARY KEY CHECK (code IN ('vip','vip_plus','super_vip','highlight','bump')),
  tetri integer NOT NULL CHECK (tetri > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotion_prices TO anon, authenticated;
GRANT ALL ON public.promotion_prices TO service_role;
ALTER TABLE public.promotion_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotion prices are public" ON public.promotion_prices FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.promotion_prices(code, tetri) VALUES
  ('vip',250),('vip_plus',400),('super_vip',900),('highlight',50),('bump',75);

CREATE TABLE public.listing_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier text CHECK (tier IN ('vip','vip_plus','super_vip')),
  days integer NOT NULL CHECK (days IN (1,3,7)),
  highlight boolean NOT NULL DEFAULT false,
  bump_mode text NOT NULL DEFAULT 'none' CHECK (bump_mode IN ('none','once','daily')),
  amount_tetri integer NOT NULL CHECK (amount_tetri > 0),
  method text NOT NULL CHECK (method IN ('wallet','card')),
  idempotency_key text NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_promotions_active_idx ON public.listing_promotions(product_id, ends_at);
GRANT SELECT ON public.listing_promotions TO authenticated;
GRANT ALL ON public.listing_promotions TO service_role;
ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own promotions" ON public.listing_promotions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER listing_promotions_immutable BEFORE UPDATE ON public.listing_promotions
  FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

CREATE OR REPLACE FUNCTION public.promotion_quote(_tier text, _days integer, _highlight boolean, _bump text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer := 0; p integer;
BEGIN
  IF _days NOT IN (1,3,7) OR _bump NOT IN ('none','once','daily') THEN RETURN NULL; END IF;
  IF _tier IS NOT NULL THEN
    SELECT tetri INTO p FROM public.promotion_prices WHERE code = _tier AND code IN ('vip','vip_plus','super_vip');
    IF p IS NULL THEN RETURN NULL; END IF;
    total := total + p * _days;
  END IF;
  IF _highlight THEN SELECT tetri INTO p FROM public.promotion_prices WHERE code = 'highlight'; total := total + p * _days; END IF;
  IF _bump <> 'none' THEN
    SELECT tetri INTO p FROM public.promotion_prices WHERE code = 'bump';
    total := total + p * (CASE WHEN _bump = 'daily' THEN _days ELSE 1 END);
  END IF;
  RETURN total;
END $$;

-- Returns 'purchased' | 'insufficient_balance' | 'not_found' | 'invalid' | 'duplicate'.
CREATE OR REPLACE FUNCTION public.purchase_promotion(_product_id uuid, _tier text, _days integer, _highlight boolean, _bump text, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); amount integer; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.listing_promotions WHERE idempotency_key = _key) THEN RETURN 'duplicate'; END IF;
  PERFORM 1 FROM public.products WHERE id = _product_id AND seller_id = uid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  amount := public.promotion_quote(_tier, _days, _highlight, _bump);
  IF amount IS NULL OR amount <= 0 THEN RETURN 'invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  SELECT COALESCE(SUM(amount_tetri),0) INTO bal FROM public.wallet_transactions WHERE user_id = uid;
  IF bal < amount THEN RETURN 'insufficient_balance'; END IF;
  INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,idempotency_key)
    VALUES (uid,'promotion_charge',-amount,_product_id,'promo:' || _key);
  INSERT INTO public.listing_promotions(product_id,user_id,tier,days,highlight,bump_mode,amount_tetri,method,idempotency_key,ends_at)
    VALUES (_product_id,uid,_tier,_days,_highlight,_bump,amount,'wallet',_key, now() + make_interval(days => _days));
  RETURN 'purchased';
END $$;

-- Current promotion effect for live listings only. rank_at never touches created_at.
CREATE OR REPLACE FUNCTION public.promoted_listings()
RETURNS TABLE(product_id uuid, tier_rank integer, highlighted boolean, rank_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    COALESCE(MAX(CASE lp.tier WHEN 'super_vip' THEN 3 WHEN 'vip_plus' THEN 2 WHEN 'vip' THEN 1 END)
      FILTER (WHERE lp.tier IS NOT NULL AND lp.ends_at > now()), 0)::integer,
    COALESCE(bool_or(lp.highlight AND lp.ends_at > now()), false),
    GREATEST(p.created_at, COALESCE(MAX(CASE
      WHEN lp.bump_mode = 'once' THEN lp.starts_at
      WHEN lp.bump_mode = 'daily' THEN lp.starts_at + make_interval(days => LEAST(lp.days - 1,
        floor(extract(epoch FROM (now() - lp.starts_at)) / 86400)::integer))
    END), p.created_at))
  FROM public.products p
  JOIN public.listing_promotions lp ON lp.product_id = p.id
  WHERE p.status = 'active' AND lp.starts_at <= now()
    AND (lp.ends_at > now() OR lp.bump_mode <> 'none')
  GROUP BY p.id, p.created_at;
$$;

REVOKE ALL ON FUNCTION public.purchase_promotion(uuid,text,integer,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_promotion(uuid,text,integer,boolean,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promotion_quote(text,integer,boolean,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promoted_listings() TO anon, authenticated;