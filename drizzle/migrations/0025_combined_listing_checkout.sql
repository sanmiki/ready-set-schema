ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS checkout_url text;
CREATE TABLE public.listing_checkouts (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 tier text CHECK(tier IN ('vip','vip_plus','super_vip')),
 days integer NOT NULL DEFAULT 3 CHECK(days IN (1,3,7)),
 highlight boolean NOT NULL DEFAULT false,
 bump text NOT NULL DEFAULT 'none' CHECK(bump IN ('none','once','daily')),
 payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
 completed boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.listing_checkouts TO authenticated;
GRANT ALL ON public.listing_checkouts TO service_role;
ALTER TABLE public.listing_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller reads own checkout" ON public.listing_checkouts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.save_listing_checkout(_product_id uuid, _tier text, _days integer, _highlight boolean, _bump text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c public.listing_checkouts; fee integer; promo integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 PERFORM 1 FROM public.products WHERE id=_product_id AND seller_id=uid AND status='draft' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=_product_id) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 promo:=public.promotion_quote(_tier,_days,_highlight,_bump);
 IF promo IS NULL OR _days IS NULL OR _highlight IS NULL OR _bump IS NULL THEN RETURN jsonb_build_object('error','invalid'); END IF;
 SELECT * INTO c FROM public.listing_checkouts WHERE product_id=_product_id FOR UPDATE;
 IF FOUND AND (c.tier IS DISTINCT FROM _tier OR c.days IS DISTINCT FROM _days OR c.highlight IS DISTINCT FROM _highlight OR c.bump IS DISTINCT FROM _bump) THEN
  UPDATE public.payments SET status='canceled',failure_reason='selection_changed',updated_at=now() WHERE id=c.payment_id AND status='pending';
  UPDATE public.listing_checkouts SET payment_id=NULL WHERE product_id=_product_id;
 END IF;
 INSERT INTO public.listing_checkouts(product_id,user_id,tier,days,highlight,bump) VALUES(_product_id,uid,_tier,_days,_highlight,_bump)
 ON CONFLICT(product_id) DO UPDATE SET tier=EXCLUDED.tier,days=EXCLUDED.days,highlight=EXCLUDED.highlight,bump=EXCLUDED.bump;
 fee:=public.listing_fee_quote();
 RETURN jsonb_build_object('fee',fee,'promotion',promo,'total',fee+promo);
END $$;
REVOKE ALL ON FUNCTION public.save_listing_checkout(uuid,text,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_listing_checkout(uuid,text,integer,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_payment_order(_service text, _product_id uuid, _tier text, _days integer, _highlight boolean, _bump text, _consent_key text, _environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); amount integer; fee integer:=0; promo integer:=0; pid uuid; st text; prm jsonb; c public.listing_checkouts; old public.payments;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF _environment IS DISTINCT FROM 'sandbox' THEN RETURN jsonb_build_object('error','disabled'); END IF;
 IF public.is_suspended(uid) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF _consent_key IS NULL OR length(_consent_key)<8 OR length(_consent_key)>100 THEN RETURN jsonb_build_object('error','invalid'); END IF;
 SELECT status::text INTO st FROM public.products WHERE id=_product_id AND seller_id=uid FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.listing_moderation WHERE product_id=_product_id) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('wallet:'||uid::text));
 IF _service='listing' THEN
  IF st<>'draft' OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=_product_id) THEN RETURN jsonb_build_object('error','already_paid'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_images WHERE product_id=_product_id) THEN RETURN jsonb_build_object('error','photos_required'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.listing_contacts WHERE product_id=_product_id AND phone ~ '^\+995[2-9][0-9]{8}$') THEN RETURN jsonb_build_object('error','phone_required'); END IF;
  SELECT * INTO c FROM public.listing_checkouts WHERE product_id=_product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid'); END IF;
  fee:=public.listing_fee_quote(); promo:=public.promotion_quote(c.tier,c.days,c.highlight,c.bump);
  amount:=fee+promo;
  prm:=jsonb_build_object('tier',c.tier,'days',c.days,'highlight',c.highlight,'bump',c.bump,'listing_fee',fee,'promotion_amount',promo,'combined',true);
  IF amount<=0 THEN RETURN jsonb_build_object('error','free'); END IF;
 ELSE
  IF _service<>'promotion' OR st<>'active' THEN RETURN jsonb_build_object('error','not_found'); END IF;
  promo:=public.promotion_quote(_tier,_days,_highlight,_bump); amount:=promo;
  prm:=jsonb_build_object('tier',_tier,'days',_days,'highlight',_highlight,'bump',_bump);
  IF amount IS NULL OR amount<=0 THEN RETURN jsonb_build_object('error','invalid'); END IF;
  IF EXISTS(SELECT 1 FROM public.listing_promotions WHERE idempotency_key=_consent_key) THEN RETURN jsonb_build_object('error','duplicate'); END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.legal_acceptances WHERE user_id=uid AND product_id=_product_id AND context=_service AND context_key=_consent_key AND document_key='terms' AND document_version='2026-11-24-draft-1' AND amount_tetri=amount) THEN RETURN jsonb_build_object('error','consent_required'); END IF;
 IF _service='listing' AND promo>0 AND NOT EXISTS(SELECT 1 FROM public.legal_acceptances WHERE user_id=uid AND product_id=_product_id AND context='promotion' AND context_key=_consent_key AND document_key='terms' AND document_version='2026-11-24-draft-1' AND amount_tetri=promo) THEN RETURN jsonb_build_object('error','consent_required'); END IF;
 SELECT * INTO old FROM public.payments WHERE user_id=uid AND product_id=_product_id AND service=_service AND status='pending' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF old.amount_tetri=amount AND old.service_params=prm AND old.created_at>now()-interval '30 minutes' THEN
   RETURN jsonb_build_object('id',old.id,'amount',old.amount_tetri,'url',old.checkout_url);
  END IF;
  UPDATE public.payments SET status='canceled',failure_reason='superseded',updated_at=now() WHERE id=old.id;
 END IF;
 INSERT INTO public.payments(user_id,purpose,product_id,amount_tetri,status,provider,service,service_params,consent_key,currency,environment)
 VALUES(uid,'listing',_product_id,amount,'pending','flitt',_service,prm,_consent_key,'GEL',_environment) RETURNING id INTO pid;
 IF _service='listing' THEN UPDATE public.listing_checkouts SET payment_id=pid WHERE product_id=_product_id; END IF;
 INSERT INTO public.payment_events(payment_id,source,outcome,details) VALUES(pid,'create','created',jsonb_build_object('amount',amount,'service',_service));
 RETURN jsonb_build_object('id',pid,'amount',amount);
END $$;
REVOKE ALL ON FUNCTION public.create_payment_order(text,uuid,text,integer,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_payment_order(text,uuid,text,integer,boolean,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_checkout_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.listing_checkouts; total integer;
BEGIN
 IF NEW.status='active' AND OLD.status<>'active' THEN
  SELECT * INTO c FROM public.listing_checkouts WHERE product_id=NEW.id;
  IF FOUND AND NOT c.completed THEN
   total:=public.listing_fee_quote()+public.promotion_quote(c.tier,c.days,c.highlight,c.bump);
   IF (total>0 OR c.payment_id IS NOT NULL) AND current_setting('meoradi.activating_payment',true) IS DISTINCT FROM c.payment_id::text THEN
    RAISE EXCEPTION 'payment_required';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_checkout_publication BEFORE UPDATE OF status ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_publication();

CREATE OR REPLACE FUNCTION public.complete_payment_order(_payment_id uuid, _order_status text, _amount integer, _currency text, _provider_payment_id text, _source text, _details jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.payments; res text; prm jsonb; c public.listing_checkouts; previous_sub text:=current_setting('request.jwt.claim.sub',true); previous_claims text:=current_setting('request.jwt.claims',true);
BEGIN
 -- Same lock order as creation and selection changes: product before payment.
 SELECT * INTO p FROM public.payments WHERE id=_payment_id;
 IF NOT FOUND THEN RETURN 'unknown_order'; END IF;
 PERFORM 1 FROM public.products WHERE id=p.product_id FOR UPDATE;
 SELECT * INTO p FROM public.payments WHERE id=_payment_id FOR UPDATE;
 IF p.status='paid' THEN
  INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES(p.id,_source,true,_order_status,'duplicate',_details); RETURN 'duplicate';
 END IF;
 IF _order_status='approved' THEN
  IF _amount IS DISTINCT FROM p.amount_tetri OR _currency IS DISTINCT FROM p.currency OR p.environment<>'sandbox' THEN
   UPDATE public.payments SET status='failed',failure_reason='amount_mismatch',provider_payment_id=_provider_payment_id,updated_at=now() WHERE id=p.id;
   INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES(p.id,_source,true,_order_status,'amount_mismatch',_details); RETURN 'amount_mismatch';
  END IF;
  UPDATE public.payments SET status='paid',provider_payment_id=_provider_payment_id,confirmed_at=now(),updated_at=now(),failure_reason=NULL WHERE id=p.id;
  INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,payment_id,idempotency_key) VALUES(p.user_id,'topup',p.amount_tetri,p.product_id,p.id,'flitt:'||p.id::text);
  PERFORM set_config('request.jwt.claim.sub',p.user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p.user_id,'role','authenticated')::text,true);
  BEGIN
   prm:=p.service_params;
   IF p.service='listing' AND COALESCE((prm->>'combined')::boolean,false) THEN
    SELECT * INTO c FROM public.listing_checkouts WHERE product_id=p.product_id FOR UPDATE;
    IF NOT FOUND OR c.payment_id IS DISTINCT FROM p.id OR c.completed OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=p.product_id) THEN RAISE EXCEPTION 'superseded'; END IF;
    IF public.listing_fee_quote() IS DISTINCT FROM (prm->>'listing_fee')::int OR public.promotion_quote(c.tier,c.days,c.highlight,c.bump) IS DISTINCT FROM (prm->>'promotion_amount')::int THEN RAISE EXCEPTION 'price_changed'; END IF;
    PERFORM set_config('meoradi.activating_payment',p.id::text,true);
    res:=public.publish_listing(p.product_id);
    IF res<>'published' THEN RAISE EXCEPTION 'publication_failed'; END IF;
    IF (prm->>'promotion_amount')::int>0 THEN
     res:=public.purchase_promotion(p.product_id,c.tier,c.days,c.highlight,c.bump,p.consent_key);
     IF res<>'purchased' THEN RAISE EXCEPTION 'promotion_failed'; END IF;
    END IF;
    UPDATE public.listing_checkouts SET completed=true WHERE product_id=p.product_id;
    res:='published';
   ELSIF p.service='listing' THEN res:=public.publish_listing(p.product_id);
   ELSE res:=public.purchase_promotion(p.product_id,prm->>'tier',(prm->>'days')::int,(prm->>'highlight')::boolean,prm->>'bump',p.consent_key);
   END IF;
  EXCEPTION WHEN OTHERS THEN res:='activation_error';
  END;
  PERFORM set_config('meoradi.activating_payment','',true);
  PERFORM set_config('request.jwt.claim.sub',COALESCE(previous_sub,''),true);
  PERFORM set_config('request.jwt.claims',COALESCE(previous_claims,''),true);
  UPDATE public.payments SET activation_result=res WHERE id=p.id;
  INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES(p.id,_source,true,_order_status,'paid:'||res,_details);
  RETURN CASE WHEN res IN ('published','purchased') THEN 'activated' ELSE 'paid_not_activated' END;
 ELSIF _order_status IN ('declined','expired','reversed') THEN
  IF p.status='pending' THEN UPDATE public.payments SET status=CASE WHEN _order_status='expired' THEN 'canceled'::public.payment_status ELSE 'failed'::public.payment_status END,failure_reason=_order_status,provider_payment_id=COALESCE(_provider_payment_id,provider_payment_id),updated_at=now() WHERE id=p.id; END IF;
  INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES(p.id,_source,true,_order_status,'not_paid',_details); RETURN 'not_paid';
 END IF;
 INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES(p.id,_source,true,_order_status,'pending',_details); RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION public.complete_payment_order(uuid,text,integer,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_order(uuid,text,integer,text,text,text,jsonb) TO service_role;