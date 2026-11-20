CREATE OR REPLACE FUNCTION public.guard_listing_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'draft' AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'listing must be published through publish_listing' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (SELECT 1 FROM public.listing_contacts WHERE product_id = NEW.id) THEN
      RAISE EXCEPTION 'contact phone is required' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.listing_contacts WHERE product_id = NEW.id AND phone ~ '^\+995[2-9][0-9]{8}$') THEN
      RAISE EXCEPTION 'contact phone is invalid' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.status <> 'draft' AND EXISTS (SELECT 1 FROM public.listing_moderation WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'listing is hidden by moderation' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

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