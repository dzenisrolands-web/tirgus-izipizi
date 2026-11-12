BEGIN;
ALTER TABLE public.invoices ADD COLUMN finance_review_reason text;
CREATE FUNCTION public.marketplace_hold_linked_invoices_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.lifecycle_version='marketplace-v1' AND (NEW.status='cancelled' OR NEW.payment_status='refunded' OR NEW.payment_review_reason IS NOT NULL) THEN
    -- Order lock is already held. Acquire all affected invoice locks in UUID
    -- order; never renumber, reprice, erase or silently pay an issued document.
    PERFORM 1 FROM public.invoices WHERE id IN
      (SELECT invoice_id FROM public.invoice_lines WHERE order_id=NEW.id) ORDER BY id FOR UPDATE;
    UPDATE public.invoices SET finance_review_reason=coalesce(finance_review_reason,'source_order_requires_credit_review')
      WHERE id IN (SELECT invoice_id FROM public.invoice_lines WHERE order_id=NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_hold_linked_invoices_v1 AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_hold_linked_invoices_v1();
CREATE FUNCTION public.marketplace_guard_invoice_hold_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.finance_review_reason IS NOT NULL THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain invoice evidence for credit reconciliation'; END IF;
    IF NEW.finance_review_reason IS DISTINCT FROM OLD.finance_review_reason
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('disputed','cancelled')) THEN
      RAISE EXCEPTION 'Credit reconciliation required before invoice sending/payment';
    END IF;
    IF NEW.total_net_cents IS DISTINCT FROM OLD.total_net_cents
       OR NEW.total_gross_cents IS DISTINCT FROM OLD.total_gross_cents
       OR NEW.total_commission_cents IS DISTINCT FROM OLD.total_commission_cents THEN
      RAISE EXCEPTION 'Do not rewrite held invoice amounts';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER marketplace_guard_invoice_hold_v1 BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_invoice_hold_v1();
REVOKE ALL ON FUNCTION public.marketplace_hold_linked_invoices_v1(),public.marketplace_guard_invoice_hold_v1()
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
