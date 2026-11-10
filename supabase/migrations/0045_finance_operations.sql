-- Apply after 0044. No historical amounts, VAT, operator or payment evidence is
-- inferred. No provider requests or notifications. Historical findings are read-only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_refund_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount_cents integer CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review', 'completed')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid,
  provider_reference text UNIQUE,
  externally_refunded_at timestamptz,
  evidence text,
  completion_reason text,
  CHECK (status <> 'completed' OR (
    amount_cents IS NOT NULL AND completed_at IS NOT NULL AND completed_by IS NOT NULL
    AND length(btrim(provider_reference)) >= 3 AND externally_refunded_at IS NOT NULL
    AND length(btrim(evidence)) >= 10 AND length(btrim(completion_reason)) >= 10
  ))
);
CREATE TABLE IF NOT EXISTS public.finance_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('order', 'invoice', 'refund')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('reviewed', 'refund_completed', 'order_cancelled', 'system_cancelled')),
  actor_id uuid,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  reference text NOT NULL CHECK (length(btrim(reference)) >= 3),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_id IS NOT NULL OR action = 'system_cancelled')
);
ALTER TABLE public.finance_refund_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_refund_queue, public.finance_review_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.finance_refund_queue, public.finance_review_events TO service_role;

CREATE OR REPLACE FUNCTION public.capture_order_finance_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'refunded' AND (
     (NEW.status = 'cancelled' AND (NEW.payment_status = 'paid' OR NEW.paid_at IS NOT NULL))
     OR nullif(btrim(NEW.payment_review_reason), '') IS NOT NULL) THEN
    INSERT INTO public.finance_refund_queue(order_id, amount_cents, reason)
    VALUES (NEW.id, CASE
      WHEN NEW.payment_received_cents > 0 THEN NEW.payment_received_cents
      WHEN nullif(btrim(NEW.payment_review_reason), '') IS NULL AND NEW.total_cents > 0 THEN NEW.total_cents
      END,
      coalesce(nullif(btrim(NEW.payment_review_reason), ''), 'paid_order_cancelled'))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS capture_order_finance_review ON public.orders;
CREATE TRIGGER capture_order_finance_review AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.capture_order_finance_review();

CREATE OR REPLACE FUNCTION public.guard_finance_fulfillment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('processing','shipped','delivered') THEN
    IF NEW.payment_status IS DISTINCT FROM 'paid' OR NEW.paid_at IS NULL
       OR nullif(btrim(NEW.payment_review_reason), '') IS NOT NULL
       OR NEW.reservation_expires_at IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id = OLD.id AND r.state = 'consumed')
       OR EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id = OLD.id AND r.state <> 'consumed')
       OR EXISTS (SELECT 1 FROM public.finance_refund_queue q WHERE q.order_id = OLD.id)
       OR NOT ((OLD.status = 'paid' AND NEW.status = 'processing')
            OR (OLD.status = 'processing' AND NEW.status = 'shipped')
            OR (OLD.status = 'shipped' AND NEW.status = 'delivered')) THEN
      RAISE EXCEPTION 'Fulfillment requires verified payment and consumed reservation evidence; manual reconciliation required';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_finance_fulfillment ON public.orders;
CREATE TRIGGER guard_finance_fulfillment BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_finance_fulfillment();

CREATE OR REPLACE FUNCTION public.cancel_order_with_review(
  p_order_id uuid, p_reason text, p_actor_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE changed boolean;
BEGIN
  IF p_actor_id IS NULL THEN
    IF p_reason IS DISTINCT FROM 'auto_cancel_unconfirmed_72h' THEN
      RAISE EXCEPTION 'System cancellation requires the documented 72-hour policy';
    END IF;
  ELSIF p_reason NOT LIKE 'admin_cancel:%'
     OR coalesce(length(btrim(substr(p_reason,14))), 0) < 10 THEN
    RAISE EXCEPTION 'Administrator cancellation requires a documented reason';
  END IF;
  changed := public.cancel_reserved_order(p_order_id, p_reason);
  IF changed THEN
    INSERT INTO public.finance_review_events(entity_type,entity_id,action,actor_id,reason,evidence,reference,details)
    VALUES ('order', p_order_id, CASE WHEN p_actor_id IS NULL THEN 'system_cancelled' ELSE 'order_cancelled' END,
      p_actor_id, p_reason,
      'Reservation cancellation completed atomically; no external payment refund initiated.',
      'cancel_reserved_order:' || p_order_id::text,
      jsonb_build_object('inventory', 'held reservations released; consumed inventory requires manual return reconciliation'));
  END IF;
  RETURN changed;
END $$;

-- An acknowledged issue is not repaired or made invoiceable. Accountants must
-- supply original evidence; no bulk historical backfill endpoint exists.
CREATE OR REPLACE FUNCTION public.record_finance_review(
  p_entity_type text, p_entity_id uuid, p_actor_id uuid,
  p_reason text, p_evidence text, p_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (
    (p_entity_type = 'order' AND EXISTS (SELECT 1 FROM public.orders WHERE id = p_entity_id)) OR
    (p_entity_type = 'invoice' AND EXISTS (SELECT 1 FROM public.invoices WHERE id = p_entity_id)) OR
    (p_entity_type = 'refund' AND EXISTS (SELECT 1 FROM public.finance_refund_queue WHERE id = p_entity_id))
  ) THEN RAISE EXCEPTION 'Review target not found'; END IF;
  INSERT INTO public.finance_review_events(entity_type, entity_id, action, actor_id, reason, evidence, reference)
  VALUES (p_entity_type, p_entity_id, 'reviewed', p_actor_id, p_reason, p_evidence, p_reference)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Records a refund ALREADY executed externally; never initiates a transfer.
-- The actor is supplied only by the server after assertSuperAdmin verifies auth.
CREATE OR REPLACE FUNCTION public.complete_manual_refund(
  p_order_id uuid, p_actor_id uuid, p_amount_cents integer,
  p_provider_reference text, p_verified_external boolean,
  p_externally_refunded_at timestamptz, p_evidence text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE q public.finance_refund_queue%ROWTYPE;
BEGIN
  -- Same lock order as cancellation and invoice eligibility: order, then queue.
  PERFORM 1 FROM public.orders WHERE id = p_order_id AND status = 'cancelled' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cancel the order through reservation reconciliation before completing its refund'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id
    AND payment_review_reason = 'conflicting_payment_amount') THEN
    RAISE EXCEPTION 'Conflicting verified payment receipts require manual provider reconciliation';
  END IF;
  SELECT * INTO q FROM public.finance_refund_queue WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund queue item not found'; END IF;
  IF q.status <> 'completed' AND EXISTS (
    SELECT 1 FROM public.orders WHERE id = p_order_id AND payment_status = 'refunded'
  ) THEN RAISE EXCEPTION 'Order already marked refunded; reconcile existing external evidence without another refund'; END IF;
  IF p_verified_external IS DISTINCT FROM true OR p_actor_id IS NULL
     OR q.amount_cents IS NULL OR p_amount_cents IS DISTINCT FROM q.amount_cents
     OR coalesce(length(btrim(p_provider_reference)), 0) < 3
     OR coalesce(length(btrim(p_evidence)), 0) < 10
     OR coalesce(length(btrim(p_reason)), 0) < 10
     OR p_externally_refunded_at IS NULL OR p_externally_refunded_at > now() THEN
    RAISE EXCEPTION 'Exact amount and verified external refund evidence required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order_id
    AND o.payment_received_cents IS NOT NULL AND o.payment_received_cents <> p_amount_cents) THEN
    RAISE EXCEPTION 'Refund amount differs from verified observed payment; manual reconciliation required';
  END IF;
  IF q.status = 'completed' THEN
    IF q.provider_reference IS DISTINCT FROM btrim(p_provider_reference)
       OR q.externally_refunded_at IS DISTINCT FROM p_externally_refunded_at
       OR q.evidence IS DISTINCT FROM btrim(p_evidence)
       OR q.completion_reason IS DISTINCT FROM btrim(p_reason) THEN
      RAISE EXCEPTION 'Refund already completed with different evidence';
    END IF;
    RETURN jsonb_build_object('id', q.id, 'status', 'completed', 'idempotent', true);
  END IF;
  UPDATE public.finance_refund_queue SET
    status = 'completed', completed_at = now(), completed_by = p_actor_id,
    provider_reference = btrim(p_provider_reference), externally_refunded_at = p_externally_refunded_at,
    evidence = btrim(p_evidence), completion_reason = btrim(p_reason)
  WHERE id = q.id;
  INSERT INTO public.finance_review_events(entity_type, entity_id, action, actor_id, reason, evidence, reference, details)
  VALUES ('refund', q.id, 'refund_completed', p_actor_id, btrim(p_reason), btrim(p_evidence),
    btrim(p_provider_reference), jsonb_build_object('amount_cents', p_amount_cents,
      'externally_refunded_at', p_externally_refunded_at, 'order_id', p_order_id));
  UPDATE public.orders SET payment_status = 'refunded' WHERE id = p_order_id;
  RETURN jsonb_build_object('id', q.id, 'status', 'completed', 'idempotent', false);
END $$;

-- Locks prevent invoice creation racing a cancellation/refund. Existing invoices
-- are never rewritten; finance_issues surfaces the need for a credit/manual adjustment.
CREATE OR REPLACE FUNCTION public.guard_invoice_order_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
  IF NOT FOUND OR o.status = 'cancelled' OR o.payment_status IS DISTINCT FROM 'paid'
     OR o.paid_at IS NULL OR nullif(btrim(o.payment_review_reason), '') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.finance_refund_queue WHERE order_id = o.id) THEN
    RAISE EXCEPTION 'Order is ineligible for invoicing; manual financial review required';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_invoice_order_eligibility ON public.invoice_lines;
CREATE TRIGGER guard_invoice_order_eligibility BEFORE INSERT OR UPDATE OF order_id ON public.invoice_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_order_eligibility();

CREATE OR REPLACE FUNCTION public.finance_issues()
RETURNS TABLE(entity_type text, entity_id uuid, issue text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT 'order', o.id, 'unknown_financial_snapshots'
  FROM public.orders o
  WHERE (o.payment_status = 'paid' OR o.paid_at IS NOT NULL) AND (
    o.paid_at IS NULL OR o.total_cents IS NULL OR o.total_cents <= 0 OR
    jsonb_typeof(o.items) IS DISTINCT FROM 'array' OR
    CASE WHEN jsonb_typeof(o.items) = 'array' THEN
      jsonb_array_length(o.items) = 0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.items) i
        WHERE jsonb_typeof(i) <> 'object'
          OR coalesce(i->>'seller_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          OR jsonb_typeof(i->'commission_rate') IS DISTINCT FROM 'number' OR i->>'commission_rate' <> '15'
          OR jsonb_typeof(i->'vat_rate') IS DISTINCT FROM 'number' OR coalesce(i->>'vat_rate', '') NOT IN ('0','5','12','21')
          OR coalesce(i->>'seller_delivery_mode', '') NOT IN ('locker','courier')
          OR jsonb_typeof(i->'seller_courier_fee_cents') IS DISTINCT FROM 'number'
          OR coalesce(i->>'seller_courier_fee_cents', '') <> CASE WHEN i->>'seller_delivery_mode' = 'courier' THEN '350' ELSE '0' END
          OR jsonb_typeof(i->'price') IS DISTINCT FROM 'number'
          OR jsonb_typeof(i->'quantity') IS DISTINCT FROM 'number'
          OR CASE WHEN jsonb_typeof(i->'price') = 'number' THEN (i->>'price')::numeric <= 0 ELSE true END
          OR CASE WHEN jsonb_typeof(i->'quantity') = 'number' THEN (i->>'quantity')::numeric <= 0 ELSE true END
      ) ELSE true END
  )
  UNION ALL
  SELECT 'order', o.id, 'legacy_stock_reconciliation_required'
  FROM public.orders o
  WHERE o.payment_status = 'paid' AND o.status IN ('paid','processing','shipped') AND (
    o.reservation_expires_at IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id = o.id AND r.state = 'consumed')
    OR EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id = o.id AND r.state <> 'consumed')
  )
  UNION ALL
  SELECT 'order', o.id, 'refund_review_required'
  FROM public.orders o
  WHERE ((o.status = 'cancelled' AND (o.payment_status = 'paid' OR o.paid_at IS NOT NULL))
    OR nullif(btrim(o.payment_review_reason), '') IS NOT NULL)
    AND o.payment_status IS DISTINCT FROM 'refunded'
    AND NOT EXISTS (SELECT 1 FROM public.finance_refund_queue q WHERE q.order_id = o.id AND q.status = 'completed')
  UNION ALL
  SELECT 'order', o.id, 'unverified_historical_refund'
  FROM public.orders o WHERE o.payment_status = 'refunded'
    AND NOT EXISTS (SELECT 1 FROM public.finance_refund_queue q WHERE q.order_id = o.id AND q.status = 'completed')
  UNION ALL
  SELECT 'invoice', i.id, 'ambiguous_invoice_operator'
  FROM public.invoices i
  WHERE nullif(btrim(i.operator_version), '') IS NULL OR jsonb_typeof(i.operator_snapshot) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM unnest(ARRAY['name','regNr','vatNr','address','phone','email','bankName','iban','bic','complaintsEmail']) k
      WHERE jsonb_typeof(i.operator_snapshot->k) IS DISTINCT FROM 'string' OR coalesce(btrim(i.operator_snapshot->>k), '') = '')
  UNION ALL
  SELECT DISTINCT 'invoice', l.invoice_id, 'credit_or_manual_adjustment_required'
  FROM public.invoice_lines l JOIN public.orders o ON o.id = l.order_id
  WHERE o.status = 'cancelled' OR o.payment_status = 'refunded'
    OR nullif(btrim(o.payment_review_reason), '') IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.finance_refund_queue q WHERE q.order_id = o.id)
$$;

-- No historical writes: opening the review screen does not create queue items.
-- A historical cancelled order can be enrolled explicitly, preserving unknown
-- amount as NULL (completion then remains blocked).
CREATE OR REPLACE FUNCTION public.enqueue_manual_refund(
  p_order_id uuid, p_actor_id uuid, p_reason text, p_evidence text, p_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT (
    (o.status = 'cancelled' AND (o.payment_status = 'paid' OR o.paid_at IS NOT NULL)) OR
    nullif(btrim(o.payment_review_reason), '') IS NOT NULL
  ) OR o.payment_status = 'refunded' THEN
    RAISE EXCEPTION 'Order requires no manual refund review';
  END IF;
  PERFORM public.record_finance_review('order', o.id, p_actor_id, p_reason, p_evidence, p_reference);
  INSERT INTO public.finance_refund_queue(order_id, amount_cents, reason)
  VALUES (o.id, CASE
    WHEN o.payment_received_cents > 0 THEN o.payment_received_cents
    WHEN nullif(btrim(o.payment_review_reason), '') IS NULL AND o.total_cents > 0 THEN o.total_cents
    END, p_reason)
  ON CONFLICT(order_id) DO NOTHING;
  SELECT id INTO v_id FROM public.finance_refund_queue WHERE order_id = o.id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.capture_order_finance_review(), public.guard_invoice_order_eligibility(),
  public.guard_finance_fulfillment() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finance_issues(),
  public.cancel_order_with_review(uuid, text, uuid),
  public.record_finance_review(text, uuid, uuid, text, text, text),
  public.enqueue_manual_refund(uuid, uuid, text, text, text),
  public.complete_manual_refund(uuid, uuid, integer, text, boolean, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_issues(),
  public.cancel_order_with_review(uuid, text, uuid),
  public.record_finance_review(text, uuid, uuid, text, text, text),
  public.enqueue_manual_refund(uuid, uuid, text, text, text),
  public.complete_manual_refund(uuid, uuid, integer, text, boolean, timestamptz, text, text)
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
