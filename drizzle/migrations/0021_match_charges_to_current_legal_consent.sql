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
          AND document_key = 'terms' AND document_version = '2026-11-24-draft-1'
          AND amount_tetri >= fee
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
      AND document_key = 'terms' AND document_version = '2026-11-24-draft-1'
      AND amount_tetri = amount
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
