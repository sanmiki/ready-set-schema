CREATE OR REPLACE FUNCTION public.guard_checkout_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.listing_checkouts; paid_required boolean;
BEGIN
 IF NEW.status='active' AND OLD.status<>'active' THEN
  SELECT * INTO c FROM public.listing_checkouts WHERE product_id=NEW.id;
  IF FOUND AND NOT c.completed THEN
   paid_required := public.promotion_quote(c.tier,c.days,c.highlight,c.bump)>0 OR c.payment_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=NEW.id AND amount_tetri>0);
   IF paid_required AND (c.payment_id IS NULL OR current_setting('meoradi.activating_payment',true) IS DISTINCT FROM c.payment_id::text) THEN RAISE EXCEPTION 'payment_required'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;