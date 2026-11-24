-- Run through the privileged database query tool; the sandbox shell role cannot impersonate API roles.
-- Existing accounts are used only as owners of rollback-only test fixtures.
BEGIN;
DO $$
#variable_conflict use_variable
DECLARE uid uuid; freeuid uuid; id uuid; freeid uuid; pay uuid; secondpay uuid; q jsonb; orderrow jsonb; res text; n int; tier text; promo int; fee int; k text; fixture_ids uuid[] := '{}';
BEGIN
 SELECT p.id INTO uid FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.listing_publications WHERE user_id=p.id) LIMIT 1;
 SELECT p.id INTO freeuid FROM public.profiles p WHERE p.id<>uid AND NOT EXISTS(SELECT 1 FROM public.listing_publications WHERE user_id=p.id) LIMIT 1;
 IF uid IS NULL OR freeuid IS NULL THEN RAISE EXCEPTION 'Need two unused test fixtures'; END IF;
 IF has_function_privilege('authenticated','public.complete_payment_order(uuid,text,integer,text,text,text,jsonb)','execute') OR has_function_privilege('anon','public.complete_payment_order(uuid,text,integer,text,text,text,jsonb)','execute') THEN RAISE EXCEPTION 'unauthorized callback access'; END IF;

 -- First free listing without a promotion: no payment or premature entitlement.
 PERFORM set_config('request.jwt.claim.sub',freeuid::text,true);
 INSERT INTO public.products(seller_id,title,price) VALUES(freeuid,'checkout free fixture',1) RETURNING products.id INTO freeid;
 fixture_ids:=array_append(fixture_ids,freeid);
 INSERT INTO public.listing_contacts(product_id,phone) VALUES(freeid,'+995555123456');
 INSERT INTO public.product_images(product_id,storage_path) VALUES(freeid,'rollback-only-photo');
 q:=public.save_listing_checkout(freeid,NULL,3,false,'none');
 IF (q->>'total')::int<>0 OR EXISTS(SELECT 1 FROM public.listing_publications WHERE user_id=freeuid) THEN RAISE EXCEPTION 'free entitlement consumed before publish'; END IF;
 res:=public.publish_listing(freeid);
 IF res<>'published' THEN RAISE EXCEPTION 'free publication failed: %',res; END IF;

 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 -- First free listing with VIP + multiple extras. Decline, cancel, retry, activation, duplicate callback.
 INSERT INTO public.products(seller_id,title,price) VALUES(uid,'checkout VIP fixture',1) RETURNING products.id INTO id;
 fixture_ids:=array_append(fixture_ids,id);
 INSERT INTO public.listing_contacts(product_id,phone) VALUES(id,'+995555123456');
 INSERT INTO public.product_images(product_id,storage_path) VALUES(id,'rollback-only-photo');
 q:=public.save_listing_checkout(id,'vip',3,true,'daily');
 IF q<>jsonb_build_object('fee',0,'promotion',1125,'total',1125) THEN RAISE EXCEPTION 'wrong free VIP total %',q; END IF;
 k:=gen_random_uuid()::text;
 PERFORM public.record_legal_acceptance('listing',k,id,1125); PERFORM public.record_legal_acceptance('promotion',k,id,1125);
 orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 IF pay IS NULL THEN RAISE EXCEPTION 'order creation failed %',orderrow; END IF;
 IF (public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox')->>'id')::uuid<>pay THEN RAISE EXCEPTION 'duplicate pending order'; END IF;
 IF EXISTS(SELECT 1 FROM public.listing_publications WHERE user_id=uid) THEN RAISE EXCEPTION 'checkout consumed free listing'; END IF;
 BEGIN
  res:=public.publish_listing(id); IF res='published' THEN RAISE EXCEPTION 'direct publication permitted'; END IF;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'payment_required' THEN RAISE; END IF; END;
 res:=public.complete_payment_order(pay,'declined',1125,'GEL','fixture','callback','{}');
 IF res<>'not_paid' OR (SELECT status FROM public.products WHERE products.id=id)<>'draft' THEN RAISE EXCEPTION 'decline published listing'; END IF;
 orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 PERFORM public.cancel_payment_order(pay);
 IF (SELECT status FROM public.products WHERE products.id=id)<>'draft' OR EXISTS(SELECT 1 FROM public.listing_publications WHERE user_id=uid) THEN RAISE EXCEPTION 'cancel consumed entitlement'; END IF;
 orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 res:=public.complete_payment_order(pay,'approved',1125,'GEL','fixture','callback','{}');
 IF res<>'activated' OR (SELECT status FROM public.products WHERE products.id=id)<>'active' THEN RAISE EXCEPTION 'VIP activation failed %',res; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.listing_promotions lp WHERE lp.product_id=id AND lp.tier='vip' AND days=3 AND highlight AND bump_mode='daily' AND ends_at=starts_at+interval '3 days') THEN RAISE EXCEPTION 'services or activation duration lost'; END IF;
 res:=public.complete_payment_order(pay,'approved',1125,'GEL','fixture','callback','{}');
 SELECT count(*) INTO n FROM public.listing_promotions WHERE product_id=id;
 IF res<>'duplicate' OR n<>1 OR (SELECT count(*) FROM public.wallet_transactions WHERE payment_id=pay)<>1 THEN RAISE EXCEPTION 'callback not idempotent'; END IF;

 -- Paid standard, VIP+, SUPER VIP: one order and exact unchanged prices.
 FOREACH tier IN ARRAY ARRAY[NULL::text,'vip_plus','super_vip'] LOOP
  INSERT INTO public.products(seller_id,title,price) VALUES(uid,'checkout paid fixture',1) RETURNING products.id INTO id;
  fixture_ids:=array_append(fixture_ids,id);
  INSERT INTO public.listing_contacts(product_id,phone) VALUES(id,'+995555123456');
  INSERT INTO public.product_images(product_id,storage_path) VALUES(id,'rollback-only-photo');
  promo:=CASE tier WHEN 'vip_plus' THEN 1200 WHEN 'super_vip' THEN 2700 ELSE 0 END;
  q:=public.save_listing_checkout(id,tier,3,false,'none');
  IF (q->>'fee')::int<>50 OR (q->>'total')::int<>50+promo THEN RAISE EXCEPTION 'paid total incorrect %',q; END IF;
  k:=gen_random_uuid()::text;
  PERFORM public.record_legal_acceptance('listing',k,id,50+promo);
  IF promo>0 THEN PERFORM public.record_legal_acceptance('promotion',k,id,promo); END IF;
  orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
  IF pay IS NULL THEN RAISE EXCEPTION 'paid order failed %',orderrow; END IF;
  res:=public.complete_payment_order(pay,'approved',50+promo,'GEL','fixture','callback','{}');
  IF res<>'activated' THEN RAISE EXCEPTION 'paid activation failed %',res; END IF;
 END LOOP;

 -- Already-published promotion purchase remains supported.
 k:=gen_random_uuid()::text; PERFORM public.record_legal_acceptance('promotion',k,id,250);
 orderrow:=public.create_payment_order('promotion',id,'vip',1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 res:=public.complete_payment_order(pay,'approved',250,'GEL','fixture','callback','{}');
 IF res<>'activated' THEN RAISE EXCEPTION 'existing listing promotion failed %',res; END IF;

 -- Removing promotions invalidates the old pending order; callback cannot publish changed choices.
 INSERT INTO public.products(seller_id,title,price) VALUES(uid,'checkout changed fixture',1) RETURNING products.id INTO id;
 fixture_ids:=array_append(fixture_ids,id);
 INSERT INTO public.listing_contacts(product_id,phone) VALUES(id,'+995555123456');
 INSERT INTO public.product_images(product_id,storage_path) VALUES(id,'rollback-only-photo');
 q:=public.save_listing_checkout(id,'vip',3,false,'none'); k:=gen_random_uuid()::text;
 PERFORM public.record_legal_acceptance('listing',k,id,800); PERFORM public.record_legal_acceptance('promotion',k,id,750);
 orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 q:=public.save_listing_checkout(id,NULL,3,false,'none');
 res:=public.complete_payment_order(pay,'approved',800,'GEL','fixture','callback','{}');
 IF res<>'paid_not_activated' OR (SELECT status FROM public.products WHERE products.id=id)<>'draft' OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=id) THEN RAISE EXCEPTION 'superseded payment activated'; END IF;

 -- Atomic rollback when promotion activation fails after publication attempt.
 q:=public.save_listing_checkout(id,'vip',3,false,'none'); k:=gen_random_uuid()::text;
 PERFORM public.record_legal_acceptance('listing',k,id,800); PERFORM public.record_legal_acceptance('promotion',k,id,750);
 orderrow:=public.create_payment_order('listing',id,NULL,1,false,'none',k,'sandbox'); pay:=(orderrow->>'id')::uuid;
 INSERT INTO public.listing_promotions(product_id,user_id,tier,days,amount_tetri,method,idempotency_key,ends_at) VALUES(freeid,freeuid,'vip',3,750,'wallet',k,now()+interval '3 days');
 res:=public.complete_payment_order(pay,'approved',800,'GEL','fixture','callback','{}');
 IF res<>'paid_not_activated' OR (SELECT status FROM public.products WHERE products.id=id)<>'draft' OR EXISTS(SELECT 1 FROM public.listing_publications WHERE product_id=id) THEN RAISE EXCEPTION 'partial publication committed'; END IF;

 -- Verify the checkout policy is participant-only and callback grants remain server-only.
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='listing_checkouts' AND qual='(user_id = auth.uid())') THEN RAISE EXCEPTION 'checkout owner policy missing'; END IF;
 RAISE NOTICE 'PASS: free, VIP, paid standard, VIP+, SUPER VIP, extras, decline, cancel, retry, duplicates, existing promotions, changed selection, atomic rollback, owner privacy';
END $$;
ROLLBACK;
