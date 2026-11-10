-- Apply first to a database clone with buyer/seller/admin/service-role sessions.
-- No data is rewritten. API routes alone cannot protect direct PostgREST writes.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_marketplace_order_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_auth_admin') OR auth.role() = 'service_role' OR public.is_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Order creation and deletion require the server' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.user_id = auth.uid() AND s.id::text = ANY(OLD.seller_ids::text[])
  ) THEN
    RAISE EXCEPTION 'Not your seller order' USING ERRCODE = '42501';
  END IF;
  -- The current row has only one aggregate fulfillment status/PIN.
  -- Until per-seller shipments exist, only admins can advance a multi-seller order.
  IF cardinality(OLD.seller_ids) > 1 THEN
    RAISE EXCEPTION 'Multi-seller fulfillment requires administrator coordination' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'locker_code', 'updated_at'])
       IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'locker_code', 'updated_at']) THEN
    RAISE EXCEPTION 'Order financial and buyer data are server-managed' USING ERRCODE = '42501';
  END IF;
  IF OLD.payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Unpaid orders cannot be fulfilled' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'paid' AND NEW.status = 'processing') OR
    (OLD.status = 'processing' AND NEW.status = 'shipped') OR
    (OLD.status = 'shipped' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid seller order transition' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'shipped' AND
     (NEW.delivery_info ->> 'locker_id') = 'tukums' THEN
    RAISE EXCEPTION 'Closed destination locker' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_marketplace_order_write ON public.orders;
CREATE TRIGGER guard_marketplace_order_write
BEFORE INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_order_write();

CREATE OR REPLACE FUNCTION public.guard_seller_moderation_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  protected_fields text[] := ARRAY[
    'verified', 'admin_notes', 'approved_at', 'approved_by', 'rejected_at', 'rejected_reason'
  ];
  field text;
BEGIN
  -- The existing trusted auth signup trigger links legacy seller accounts as postgres.
  IF current_user IN ('postgres', 'supabase_auth_admin') OR auth.role() = 'service_role' OR public.is_super_admin() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not your seller profile' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending') OR COALESCE(NEW.verified, false) THEN
      RAISE EXCEPTION 'Seller approval requires an administrator' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF OLD.user_id IS DISTINCT FROM auth.uid() OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Seller ownership is server-managed' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'Seller approval requires an administrator' USING ERRCODE = '42501';
    END IF;
    FOREACH field IN ARRAY protected_fields LOOP
      IF (to_jsonb(NEW) -> field) IS DISTINCT FROM (to_jsonb(OLD) -> field) THEN
        RAISE EXCEPTION 'Seller moderation fields require an administrator' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_seller_moderation_write ON public.sellers;
CREATE TRIGGER guard_seller_moderation_write
BEFORE INSERT OR UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.guard_seller_moderation_write();

NOTIFY pgrst, 'reload schema';
COMMIT;
