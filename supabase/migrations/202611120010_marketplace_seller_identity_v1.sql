BEGIN;
-- These are private legal/consent facts. Never embed them in buyer-readable
-- orders JSON. Current bank instructions remain governed by agreement 8.3;
-- a bank change alone is not treated as a different historic legal entity.
CREATE TABLE public.marketplace_seller_identity_v1 (
  order_id uuid NOT NULL REFERENCES public.orders(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  snapshot jsonb NOT NULL,
  PRIMARY KEY(order_id,seller_id)
);
ALTER TABLE public.marketplace_seller_identity_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_seller_identity_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_seller_identity_v1 TO service_role;
CREATE FUNCTION public.marketplace_seller_identity_json_v1(p_seller public.sellers)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('user_id',(p_seller).user_id,
    'legal_name',(p_seller).legal_name,'registration_number',(p_seller).registration_number,
    'vat_number',(p_seller).vat_number,'is_vat_registered',(p_seller).is_vat_registered,
    'legal_address',(p_seller).legal_address,'self_billing_agreed',(p_seller).self_billing_agreed,
    'self_billing_agreement_version',(p_seller).self_billing_agreement_version)
$$;
CREATE FUNCTION public.marketplace_capture_seller_identity_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.lifecycle_version='marketplace-v1' THEN
    INSERT INTO public.marketplace_seller_identity_v1(order_id,seller_id,snapshot)
      SELECT NEW.id,s.id,public.marketplace_seller_identity_json_v1(s)
      FROM public.sellers s WHERE s.id=ANY(NEW.seller_ids);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_capture_seller_identity_v1 AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_capture_seller_identity_v1();
REVOKE ALL ON FUNCTION public.marketplace_capture_seller_identity_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.marketplace_seller_identity_json_v1(public.sellers) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_seller_identity_json_v1(public.sellers) TO service_role;
COMMIT;
