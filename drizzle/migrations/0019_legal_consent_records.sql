CREATE TABLE public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_key text NOT NULL CHECK (document_key IN ('terms','privacy','listing_rules','refund_policy')),
  document_version text NOT NULL,
  context text NOT NULL CHECK (context IN ('registration','listing','promotion')),
  context_key text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  amount_tetri integer CHECK (amount_tetri IS NULL OR amount_tetri > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_key, context, context_key)
);
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own legal acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances(user_id, created_at DESC);
CREATE INDEX legal_acceptances_product_idx ON public.legal_acceptances(product_id, context, context_key);

CREATE OR REPLACE FUNCTION public.legal_acceptances_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'legal acceptances are append-only'; END
$$;
CREATE TRIGGER legal_acceptances_immutable BEFORE UPDATE OR DELETE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.legal_acceptances_immutable();

CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  _context text,
  _context_key text,
  _product_id uuid DEFAULT NULL,
  _amount_tetri integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  document text;
  documents text[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _context_key IS NULL OR length(_context_key) < 8 OR length(_context_key) > 100 THEN
    RAISE EXCEPTION 'invalid acceptance key';
  END IF;

  IF _context = 'registration' THEN
    IF _product_id IS NOT NULL OR _amount_tetri IS NOT NULL THEN RAISE EXCEPTION 'invalid registration acceptance'; END IF;
    documents := ARRAY['terms','privacy','listing_rules'];
  ELSIF _context = 'listing' THEN
    IF _product_id IS NULL OR _amount_tetri IS NULL OR _amount_tetri <= 0 THEN RAISE EXCEPTION 'invalid listing acceptance'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND seller_id = uid) THEN RAISE EXCEPTION 'listing not found'; END IF;
    documents := ARRAY['terms','listing_rules','refund_policy'];
  ELSIF _context = 'promotion' THEN
    IF _product_id IS NULL OR _amount_tetri IS NULL OR _amount_tetri <= 0 THEN RAISE EXCEPTION 'invalid promotion acceptance'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND seller_id = uid) THEN RAISE EXCEPTION 'listing not found'; END IF;
    documents := ARRAY['terms','refund_policy'];
  ELSE
    RAISE EXCEPTION 'invalid acceptance context';
  END IF;

  FOREACH document IN ARRAY documents LOOP
    INSERT INTO public.legal_acceptances(
      user_id, document_key, document_version, context, context_key, product_id, amount_tetri
    ) VALUES (
      uid, document, '2026-11-24-draft-1', _context, _context_key, _product_id, _amount_tetri
    ) ON CONFLICT (user_id, document_key, context, context_key) DO NOTHING;
  END LOOP;
END
$$;
REVOKE ALL ON FUNCTION public.record_legal_acceptance(text,text,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(text,text,uuid,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publish_listing(_product_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bal integer; fee integer; free_first boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.is_suspended(uid) THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.products WHERE id = _product_id AND seller_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.listing_moderation WHERE product_id = _product_id) THEN RETURN 'not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.listing_contacts WHERE product_id = _product_id) THEN RETURN 'phone_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.listing_contacts WHERE product_id = _product_id AND phone ~ '^\+995[2-9][0-9]{8}$') THEN RETURN 'phone_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  SELECT listing_fee_tetri, first_listing_free INTO fee, free_first FROM public.platform_settings WHERE id;

  IF NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = _product_id) THEN
    IF (free_first AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = uid)) OR fee = 0 THEN
      INSERT INTO public.listing_publications(product_id,user_id,method,amount_tetri) VALUES (_product_id, uid, 'free', 0);
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.legal_acceptances
        WHERE user_id = uid AND product_id = _product_id AND context = 'listing'
      ) THEN RETURN 'consent_required'; END IF;
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
REVOKE ALL ON FUNCTION public.publish_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_listing(uuid) TO authenticated;

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
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_acceptances
    WHERE user_id = uid AND product_id = _product_id AND context = 'promotion' AND context_key = _key
  ) THEN RETURN 'consent_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  SELECT COALESCE(SUM(amount_tetri),0) INTO bal FROM public.wallet_transactions WHERE user_id = uid;
  IF bal < amount THEN RETURN 'insufficient_balance'; END IF;
  INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,idempotency_key)
    VALUES (uid,'promotion_charge',-amount,_product_id,'promo:' || _key);
  INSERT INTO public.listing_promotions(product_id,user_id,tier,days,highlight,bump_mode,amount_tetri,method,idempotency_key,ends_at)
    VALUES (_product_id,uid,_tier,_days,_highlight,_bump,amount,'wallet',_key, now() + make_interval(days => _days));
  RETURN 'purchased';
END $$;
REVOKE ALL ON FUNCTION public.purchase_promotion(uuid,text,integer,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_promotion(uuid,text,integer,boolean,text,text) TO authenticated;
