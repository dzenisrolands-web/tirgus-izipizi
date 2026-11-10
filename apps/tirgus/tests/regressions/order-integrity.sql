-- ONLY for a disposable local Postgres database; creates isolated fixture tables/roles.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT nullif(current_setting('test.uid', true), '')::uuid
$$;
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$
  SELECT coalesce(current_setting('test.admin', true), '') = 'true'
$$;
CREATE TABLE public.sellers (
  id text PRIMARY KEY, user_id uuid, status text, verified boolean DEFAULT false,
  admin_notes text, approved_at timestamptz, approved_by uuid,
  rejected_at timestamptz, rejected_reason text, name text, updated_at timestamptz
);
CREATE TABLE public.orders (
  id text PRIMARY KEY, seller_ids text[], status text, payment_status text,
  total_cents integer, buyer_email text, buyer_id uuid, locker_code text,
  delivery_info jsonb, items jsonb, updated_at timestamptz
);
GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role, anon;
GRANT ALL ON public.sellers, public.orders TO authenticated, service_role, anon;
INSERT INTO sellers(id,user_id,status,name) VALUES
  ('seller','11111111-1111-1111-1111-111111111111','approved','Real seller'),
  ('other','22222222-2222-2222-2222-222222222222','pending','Other seller');
INSERT INTO orders(id,seller_ids,status,payment_status,total_cents,delivery_info) VALUES
  ('paid',ARRAY['seller'],'paid','paid',1250,'{"locker_id":"brivibas"}'),
  ('awaiting',ARRAY['seller'],'pending','awaiting',1250,'{}'),
  ('closed',ARRAY['seller'],'processing','paid',1250,'{"locker_id":"tukums"}'),
  ('multi',ARRAY['seller','other'],'processing','paid',1250,'{"locker_id":"brivibas"}');
\ir ../../../../supabase/migrations/0042_order_integrity_guards.sql

SET ROLE authenticated;
SELECT set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
DO $$
BEGIN
  BEGIN
    UPDATE orders SET total_cents=1 WHERE id='paid';
    RAISE EXCEPTION 'FAIL: seller changed total';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE orders SET payment_status='paid',status='paid' WHERE id='awaiting';
    RAISE EXCEPTION 'FAIL: seller fabricated payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE orders SET buyer_email='stolen@example.invalid' WHERE id='paid';
    RAISE EXCEPTION 'FAIL: seller changed buyer PII';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO orders(id,seller_ids,status) VALUES('fake',ARRAY['seller'],'paid');
    RAISE EXCEPTION 'FAIL: seller inserted order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM orders WHERE id='paid';
    RAISE EXCEPTION 'FAIL: seller deleted order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE orders SET status='shipped' WHERE id='closed';
    RAISE EXCEPTION 'FAIL: seller shipped to closed locker';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE orders SET status='shipped' WHERE id='multi';
    RAISE EXCEPTION 'FAIL: seller advanced entire multi-seller order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE sellers SET verified=true WHERE id='seller';
    RAISE EXCEPTION 'FAIL: seller self-verified';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE sellers SET status='approved' WHERE id='other';
    RAISE EXCEPTION 'FAIL: unrelated seller approved profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE orders SET status='processing' WHERE id='paid';
  UPDATE orders SET status='shipped',locker_code='1234' WHERE id='paid';
  UPDATE orders SET status='delivered' WHERE id='paid';
  UPDATE sellers SET name='Updated name' WHERE id='seller';
END;
$$;

SELECT set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
DO $$
BEGIN
  BEGIN
    UPDATE sellers SET status='approved' WHERE id='other';
    RAISE EXCEPTION 'FAIL: seller self-approved';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE orders SET locker_code='attacker' WHERE id='paid';
    RAISE EXCEPTION 'FAIL: unrelated seller changed order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;

SET ROLE service_role;
UPDATE orders SET status='paid',payment_status='paid' WHERE id='awaiting';
SET ROLE authenticated;
SELECT set_config('test.admin', 'true', false);
UPDATE orders SET total_cents=1500 WHERE id='paid';
UPDATE sellers SET status='approved' WHERE id='other';
RESET ROLE;
DO $$
BEGIN
  IF (SELECT status FROM orders WHERE id='paid') <> 'delivered'
     OR (SELECT total_cents FROM orders WHERE id='paid') <> 1500
     OR (SELECT payment_status FROM orders WHERE id='awaiting') <> 'paid'
     OR (SELECT name FROM sellers WHERE id='seller') <> 'Updated name' THEN
    RAISE EXCEPTION 'FAIL: permitted operations did not persist';
  END IF;
  RAISE NOTICE 'PASS: order financial/moderation guards and legitimate fulfillment/admin/service flows';
END;
$$;
