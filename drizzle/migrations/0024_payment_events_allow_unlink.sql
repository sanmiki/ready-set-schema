CREATE OR REPLACE FUNCTION public.payment_events_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_id IS NULL AND OLD.payment_id IS NOT NULL
     AND NEW.id = OLD.id AND NEW.outcome = OLD.outcome AND NEW.details = OLD.details AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'payment event log is append-only';
END $$;
DROP TRIGGER payment_events_immutable ON public.payment_events;
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.payment_events_guard();