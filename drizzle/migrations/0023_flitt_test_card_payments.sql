ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS service text CHECK (service IN ('listing','promotion')),
  ADD COLUMN IF NOT EXISTS service_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_key text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GEL',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none','requested','partial','refunded')),
  ADD COLUMN IF NOT EXISTS refunded_tetri integer NOT NULL DEFAULT 0 CHECK (refunded_tetri >= 0),
  ADD COLUMN IF NOT EXISTS activation_result text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('callback','status_check','create','admin')),
  signature_valid boolean,
  order_status text,
  outcome text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_payment_idx ON public.payment_events(payment_id, created_at DESC);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

CREATE OR REPLACE FUNCTION public.create_payment_order(_service text, _product_id uuid, _tier text, _days integer, _highlight boolean, _bump text, _consent_key text, _environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); amount integer; fee integer; free_first boolean; pid uuid; st text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _environment IS DISTINCT FROM 'sandbox' THEN RETURN jsonb_build_object('error','disabled'); END IF;
  IF public.is_suspended(uid) THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF _consent_key IS NULL OR length(_consent_key) < 8 OR length(_consent_key) > 100 THEN RETURN jsonb_build_object('error','invalid'); END IF;
  SELECT status::text INTO st FROM public.products WHERE id = _product_id AND seller_id = uid;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.listing_moderation WHERE product_id = _product_id) THEN
    RETURN jsonb_build_object('error','not_found'); END IF;
  IF _service = 'listing' THEN
    IF EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = _product_id) THEN RETURN jsonb_build_object('error','already_paid'); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.listing_contacts WHERE product_id = _product_id AND phone ~ '^\+995[2-9][0-9]{8}$') THEN RETURN jsonb_build_object('error','phone_required'); END IF;
    SELECT listing_fee_tetri, first_listing_free INTO fee, free_first FROM public.platform_settings WHERE id;
    IF fee = 0 OR (free_first AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = uid)) THEN
      RETURN jsonb_build_object('error','free'); END IF;
    amount := fee;
    IF NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = uid AND product_id = _product_id AND context = 'listing'
      AND document_key = 'terms' AND document_version = '2026-11-24-draft-1' AND amount_tetri >= fee) THEN RETURN jsonb_build_object('error','consent_required'); END IF;
  ELSIF _service = 'promotion' THEN
    IF st <> 'active' THEN RETURN jsonb_build_object('error','not_found'); END IF;
    amount := public.promotion_quote(_tier, _days, _highlight, _bump);
    IF amount IS NULL OR amount <= 0 THEN RETURN jsonb_build_object('error','invalid'); END IF;
    IF EXISTS (SELECT 1 FROM public.listing_promotions WHERE idempotency_key = _consent_key) THEN RETURN jsonb_build_object('error','duplicate'); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = uid AND product_id = _product_id AND context = 'promotion' AND context_key = _consent_key
      AND document_key = 'terms' AND document_version = '2026-11-24-draft-1' AND amount_tetri = amount) THEN RETURN jsonb_build_object('error','consent_required'); END IF;
  ELSE RETURN jsonb_build_object('error','invalid'); END IF;
  INSERT INTO public.payments(user_id,purpose,product_id,amount_tetri,status,provider,service,service_params,consent_key,currency,environment)
  VALUES (uid,'listing',_product_id,amount,'pending','flitt',_service,
    CASE WHEN _service='promotion' THEN jsonb_build_object('tier',_tier,'days',_days,'highlight',_highlight,'bump',_bump) ELSE '{}'::jsonb END,
    _consent_key,'GEL',_environment)
  RETURNING id INTO pid;
  INSERT INTO public.payment_events(payment_id,source,outcome,details) VALUES (pid,'create','created',jsonb_build_object('amount',amount,'service',_service));
  RETURN jsonb_build_object('id',pid,'amount',amount);
END $$;
REVOKE ALL ON FUNCTION public.create_payment_order(text,uuid,text,integer,boolean,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_order(text,uuid,text,integer,boolean,text,text,text) TO authenticated;

-- Server-only: called after the Flitt signature has been verified.
CREATE OR REPLACE FUNCTION public.complete_payment_order(_payment_id uuid, _order_status text, _amount integer, _currency text, _provider_payment_id text, _source text, _details jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments; res text; prm jsonb;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_order'; END IF;
  IF p.status = 'paid' THEN
    INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES (p.id,_source,true,_order_status,'duplicate',_details);
    RETURN 'duplicate';
  END IF;
  IF _order_status = 'approved' THEN
    IF _amount IS DISTINCT FROM p.amount_tetri OR _currency IS DISTINCT FROM p.currency THEN
      UPDATE public.payments SET status='failed', failure_reason='amount_mismatch', provider_payment_id=_provider_payment_id, updated_at=now() WHERE id=p.id;
      INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES (p.id,_source,true,_order_status,'amount_mismatch',_details);
      RETURN 'amount_mismatch';
    END IF;
    UPDATE public.payments SET status='paid', provider_payment_id=_provider_payment_id, confirmed_at=now(), updated_at=now(), failure_reason=NULL WHERE id=p.id;
    INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,payment_id,idempotency_key)
      VALUES (p.user_id,'topup',p.amount_tetri,p.product_id,p.id,'flitt:' || p.id::text);
    -- Run the existing, fully-checked activation as the paying user.
    PERFORM set_config('request.jwt.claim.sub', p.user_id::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',p.user_id,'role','authenticated')::text, true);
    BEGIN
      IF p.service = 'listing' THEN
        res := public.publish_listing(p.product_id);
      ELSE
        prm := p.service_params;
        res := public.purchase_promotion(p.product_id, prm->>'tier', (prm->>'days')::int, (prm->>'highlight')::boolean, prm->>'bump', p.consent_key);
      END IF;
    EXCEPTION WHEN OTHERS THEN res := 'activation_error';
    END;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE public.payments SET activation_result = res WHERE id = p.id;
    INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES (p.id,_source,true,_order_status,'paid:' || res,_details);
    RETURN CASE WHEN res IN ('published','purchased') THEN 'activated' ELSE 'paid_not_activated' END;
  ELSIF _order_status IN ('declined','expired','reversed') THEN
    IF p.status = 'pending' THEN
      UPDATE public.payments SET status = CASE WHEN _order_status='expired' THEN 'canceled'::public.payment_status ELSE 'failed'::public.payment_status END,
        failure_reason=_order_status, provider_payment_id=COALESCE(_provider_payment_id,provider_payment_id), updated_at=now() WHERE id=p.id;
    END IF;
    INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES (p.id,_source,true,_order_status,'not_paid',_details);
    RETURN 'not_paid';
  END IF;
  INSERT INTO public.payment_events(payment_id,source,signature_valid,order_status,outcome,details) VALUES (p.id,_source,true,_order_status,'pending',_details);
  RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION public.complete_payment_order(uuid,text,integer,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_order(uuid,text,integer,text,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_payment_order(_payment_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payments SET status='canceled', failure_reason='user_canceled', updated_at=now()
   WHERE id=_payment_id AND user_id=auth.uid() AND status='pending';
  RETURN CASE WHEN FOUND THEN 'canceled' ELSE 'unchanged' END;
END $$;
REVOKE ALL ON FUNCTION public.cancel_payment_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payment_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_payments(_limit int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'payments', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC),'[]'::jsonb) FROM (
      SELECT py.id, py.service, py.amount_tetri, py.currency, py.status, py.environment, py.provider_payment_id, py.refund_status,
             py.refunded_tetri, py.activation_result, py.failure_reason, py.created_at, py.confirmed_at, pr.username
      FROM public.payments py JOIN public.profiles pr ON pr.id = py.user_id ORDER BY py.created_at DESC LIMIT LEAST(_limit,200)) x),
    'stats', (SELECT jsonb_build_object(
      'paid_count', count(*) FILTER (WHERE status='paid'),
      'paid_tetri', COALESCE(sum(amount_tetri) FILTER (WHERE status='paid'),0),
      'failed_count', count(*) FILTER (WHERE status='failed'),
      'pending_count', count(*) FILTER (WHERE status='pending'),
      'refunded_tetri', COALESCE(sum(refunded_tetri),0),
      'sandbox_paid_tetri', COALESCE(sum(amount_tetri) FILTER (WHERE status='paid' AND environment='sandbox'),0)) FROM public.payments),
    'events', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC),'[]'::jsonb) FROM (
      SELECT e.id, e.payment_id, e.source, e.signature_valid, e.order_status, e.outcome, e.created_at
      FROM public.payment_events e ORDER BY e.created_at DESC LIMIT 100) x)
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_payments(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments(int) TO authenticated;