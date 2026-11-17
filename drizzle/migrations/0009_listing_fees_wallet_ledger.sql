CREATE TYPE public.wallet_tx_kind AS ENUM ('topup','listing_charge','refund');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','canceled');
CREATE TYPE public.payment_purpose AS ENUM ('topup','listing');
CREATE TYPE public.publication_method AS ENUM ('free','wallet','card','legacy');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose public.payment_purpose NOT NULL,
  product_id uuid,
  amount_tetri integer NOT NULL CHECK (amount_tetri > 0),
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider text,
  provider_ref text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.wallet_tx_kind NOT NULL,
  amount_tetri integer NOT NULL CHECK (amount_tetri <> 0),
  product_id uuid,
  payment_id uuid UNIQUE REFERENCES public.payments(id),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_user_idx ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'wallet ledger is append-only'; END $$;
CREATE TRIGGER wallet_transactions_immutable BEFORE UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

-- No FK to products: deleting a listing must not restore the free allowance.
CREATE TABLE public.listing_publications (
  product_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  method public.publication_method NOT NULL,
  amount_tetri integer NOT NULL DEFAULT 0 CHECK (amount_tetri >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_publications_user_idx ON public.listing_publications(user_id);
GRANT SELECT ON public.listing_publications TO authenticated;
GRANT ALL ON public.listing_publications TO service_role;
ALTER TABLE public.listing_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own publications" ON public.listing_publications FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.listing_publications (product_id, user_id, method, amount_tetri, created_at)
SELECT id, seller_id, 'legacy', 0, created_at FROM public.products WHERE status <> 'draft';

-- Block any path to a non-draft status that has not gone through publish_listing.
CREATE OR REPLACE FUNCTION public.guard_listing_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'draft' AND NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'listing must be published through publish_listing' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_guard_status BEFORE INSERT OR UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_status();

CREATE OR REPLACE FUNCTION public.wallet_balance() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount_tetri),0)::integer FROM public.wallet_transactions WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.listing_fee_quote() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = auth.uid()) THEN 50 ELSE 0 END;
$$;

-- Returns 'published' | 'insufficient_balance' | 'not_found'.
CREATE OR REPLACE FUNCTION public.publish_listing(_product_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM public.products WHERE id = _product_id AND seller_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || uid::text));

  IF NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE product_id = _product_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.listing_publications WHERE user_id = uid) THEN
      INSERT INTO public.listing_publications(product_id,user_id,method,amount_tetri) VALUES (_product_id, uid, 'free', 0);
    ELSE
      SELECT COALESCE(SUM(amount_tetri),0) INTO bal FROM public.wallet_transactions WHERE user_id = uid;
      IF bal < 50 THEN RETURN 'insufficient_balance'; END IF;
      INSERT INTO public.wallet_transactions(user_id,kind,amount_tetri,product_id,idempotency_key)
        VALUES (uid,'listing_charge',-50,_product_id,'listing:' || _product_id::text);
      INSERT INTO public.listing_publications(product_id,user_id,method,amount_tetri) VALUES (_product_id, uid, 'wallet', 50);
    END IF;
  END IF;

  UPDATE public.products SET status = 'active' WHERE id = _product_id;
  RETURN 'published';
END $$;

REVOKE ALL ON FUNCTION public.wallet_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listing_fee_quote() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listing_fee_quote() TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_listing(uuid) TO authenticated;