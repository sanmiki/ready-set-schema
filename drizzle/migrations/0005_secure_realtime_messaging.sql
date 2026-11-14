CREATE TABLE public.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT conversation_distinct_participants CHECK (buyer_id <> seller_id),
 CONSTRAINT conversation_unique_product UNIQUE (buyer_id, seller_id, product_id)
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (buyer_id, seller_id));
CREATE INDEX conversations_buyer_updated ON public.conversations(buyer_id, updated_at DESC);
CREATE INDEX conversations_seller_updated ON public.conversations(seller_id, updated_at DESC);
CREATE TABLE public.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.buyer_id,c.seller_id)));
CREATE POLICY "participants send as themselves" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.buyer_id,c.seller_id)));
CREATE INDEX messages_conversation_created ON public.messages(conversation_id,created_at,id);
CREATE INDEX messages_unread ON public.messages(conversation_id,sender_id) WHERE read_at IS NULL;
CREATE FUNCTION public.prepare_message() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NEW.sender_id <> auth.uid() THEN RAISE EXCEPTION 'Unauthorized sender'; END IF;
 NEW.sender_id := auth.uid(); NEW.content := btrim(NEW.content); NEW.created_at := now(); NEW.read_at := NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER prepare_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prepare_message();
CREATE FUNCTION public.bump_conversation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END $$;
CREATE TRIGGER bump_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();
CREATE FUNCTION public.start_conversation(_product_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seller uuid; conversation uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT seller_id INTO seller FROM public.products WHERE id = _product_id AND status = 'active';
 IF seller IS NULL THEN RAISE EXCEPTION 'Unavailable product'; END IF;
 IF seller = auth.uid() THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;
 INSERT INTO public.conversations(buyer_id,seller_id,product_id) VALUES(auth.uid(),seller,_product_id) ON CONFLICT(buyer_id,seller_id,product_id) DO UPDATE SET product_id = EXCLUDED.product_id RETURNING id INTO conversation;
 RETURN conversation;
END $$;
REVOKE ALL ON FUNCTION public.start_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;
CREATE FUNCTION public.mark_conversation_read(_conversation_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.conversations WHERE id = _conversation_id AND auth.uid() IN (buyer_id,seller_id)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.messages SET read_at = now() WHERE conversation_id = _conversation_id AND sender_id <> auth.uid() AND read_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
CREATE FUNCTION public.messaging_inbox() RETURNS TABLE(id uuid,buyer_id uuid,seller_id uuid,product_id uuid,updated_at timestamptz,other_name text,product_title text,image_path text,latest_content text,unread_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT c.id,c.buyer_id,c.seller_id,c.product_id,c.updated_at,coalesce(p.display_name,p.username),coalesce(pr.title,'ნივთი აღარ არის ხელმისაწვდომი'),
 CASE WHEN pr.status = 'active' THEN (SELECT storage_path FROM public.product_images WHERE product_id = pr.id ORDER BY sort_order LIMIT 1) END,
 (SELECT content FROM public.messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),
 (SELECT count(*) FROM public.messages WHERE conversation_id=c.id AND sender_id <> auth.uid() AND read_at IS NULL)
 FROM public.conversations c JOIN public.profiles p ON p.id = CASE WHEN c.buyer_id=auth.uid() THEN c.seller_id ELSE c.buyer_id END
 LEFT JOIN public.products pr ON pr.id=c.product_id
 WHERE auth.uid() IN(c.buyer_id,c.seller_id) ORDER BY c.updated_at DESC,c.id;
$$;
REVOKE ALL ON FUNCTION public.messaging_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_inbox() TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations, public.messages;