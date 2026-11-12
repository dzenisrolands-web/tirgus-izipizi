-- Narrowly adapted from draft PR10; no historical backfill or issuance.
-- Apply before deploying snapshot-aware invoice generation.
-- No historical rows, numbers, amounts or operator identities are backfilled.
-- Legacy ambiguous rows require an accountant-verified snapshot + version.
BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS operator_version text,
  ADD COLUMN IF NOT EXISTS operator_snapshot jsonb;

-- Reconcile columns already written by the generator but absent from tracked
-- migrations. Nullable deliberately: do not invent amounts for issued invoices.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_ex_vat_cents integer,
  ADD COLUMN IF NOT EXISTS total_product_vat_cents integer,
  ADD COLUMN IF NOT EXISTS commission_vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_vat_cents integer,
  ADD COLUMN IF NOT EXISTS courier_fee_cents integer,
  ADD COLUMN IF NOT EXISTS courier_order_count integer;
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount_cents integer,
  ADD COLUMN IF NOT EXISTS ex_vat_cents integer;

CREATE OR REPLACE FUNCTION public.guard_invoice_operator_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  field text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.operator_snapshot IS NOT NULL OR OLD.operator_version IS NOT NULL THEN
      IF NEW.operator_snapshot IS DISTINCT FROM OLD.operator_snapshot
         OR NEW.operator_version IS DISTINCT FROM OLD.operator_version THEN
        RAISE EXCEPTION 'Invoice operator snapshot is immutable';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.operator_snapshot IS NULL AND NEW.operator_version IS NULL THEN
      RETURN NEW; -- ordinary status update of a legacy invoice
    END IF;
  END IF;

  -- Preserve the old application's legacy insert path during the default-off rollout.
  IF NEW.operator_version IS NULL AND NEW.operator_snapshot IS NULL THEN RETURN NEW; END IF;
  IF NEW.operator_version IS NULL OR btrim(NEW.operator_version) = ''
     OR NEW.operator_snapshot IS NULL
     OR jsonb_typeof(NEW.operator_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Invoice requires an operator version and snapshot';
  END IF;
  FOREACH field IN ARRAY ARRAY[
    'name', 'regNr', 'vatNr', 'address', 'phone', 'email',
    'bankName', 'iban', 'bic', 'complaintsEmail'
  ] LOOP
    IF jsonb_typeof(NEW.operator_snapshot -> field) IS DISTINCT FROM 'string'
       OR btrim(NEW.operator_snapshot ->> field) = '' THEN
      RAISE EXCEPTION 'Invoice operator snapshot missing field %', field;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_operator_snapshot_guard ON public.invoices;
CREATE TRIGGER invoice_operator_snapshot_guard
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_operator_snapshot();

COMMIT;

-- Apply after 0038. No historical data is recomputed or backfilled.
-- SECURITY INVOKER: only the existing service_role may invoke these functions;
-- all table constraints and the immutable operator-snapshot guard still apply.
BEGIN;

CREATE OR REPLACE FUNCTION public.marketplace_invoice_ready_v1()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Invoice generation requires service_role' USING ERRCODE = '42501';
  END IF;
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_create_invoice_v1(p_header jsonb, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  h public.invoices%ROWTYPE;
  v_invoice_id uuid;
  v_invoice_number text;
  gross bigint;
  product_vat bigint;
  commission bigint;
  net bigint;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Invoice generation requires service_role' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_header) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Invoice requires a header and nonempty lines';
  END IF;
  h := jsonb_populate_record(NULL::public.invoices, p_header);
  IF h.seller_id IS NULL OR h.period_start IS NULL OR h.period_end IS NULL
     OR h.period_start > h.period_end
     OR h.total_gross_cents IS NULL OR h.total_ex_vat_cents IS NULL
     OR h.total_product_vat_cents IS NULL OR h.total_commission_cents IS NULL
     OR h.commission_vat_cents IS NULL OR h.total_net_cents IS NULL
     OR h.commission_vat_rate IS DISTINCT FROM 21
     OR h.courier_order_count IS NULL OR h.courier_order_count < 0
     OR h.courier_fee_cents IS DISTINCT FROM h.courier_order_count * 350
     OR coalesce(btrim(h.seller_legal_name), '') = ''
     OR coalesce(btrim(h.seller_bank_iban), '') = ''
     OR h.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Invalid invoice header';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_populate_recordset(NULL::public.invoice_lines, p_lines) l
    WHERE l.order_id IS NULL OR coalesce(btrim(l.order_number), '') = ''
      OR l.order_date IS NULL OR l.order_date < h.period_start OR l.order_date > h.period_end
      OR coalesce(btrim(l.product_title), '') = ''
      OR l.quantity IS NULL OR l.quantity <= 0
      OR l.unit_price_cents IS NULL OR l.unit_price_cents <= 0
      OR l.line_gross_cents IS NULL OR l.line_gross_cents <= 0
      OR l.line_gross_cents <> l.unit_price_cents * l.quantity
      OR l.vat_rate IS NULL OR l.vat_rate NOT IN (0, 5, 12, 21)
      OR l.vat_amount_cents IS NULL OR l.vat_amount_cents < 0
      OR l.ex_vat_cents IS NULL OR l.ex_vat_cents < 0
      OR l.line_gross_cents <> l.ex_vat_cents + l.vat_amount_cents
      OR l.commission_rate IS DISTINCT FROM 15
      OR l.commission_cents IS NULL OR l.commission_cents < 0
      OR l.net_cents IS NULL OR l.net_cents <> l.line_gross_cents - l.commission_cents
      OR l.line_order IS NULL OR l.line_order < 0
  ) OR (
    SELECT count(DISTINCT l.line_order) <> count(*)
    FROM jsonb_populate_recordset(NULL::public.invoice_lines, p_lines) l
  ) THEN
    RAISE EXCEPTION 'Invalid invoice lines; manual reconciliation required';
  END IF;

  SELECT sum(l.line_gross_cents), sum(l.vat_amount_cents),
         sum(l.commission_cents), sum(l.net_cents)
    INTO gross, product_vat, commission, net
    FROM jsonb_populate_recordset(NULL::public.invoice_lines, p_lines) l;
  IF h.total_gross_cents <> gross OR h.total_product_vat_cents <> product_vat
     OR h.total_ex_vat_cents <> gross - product_vat
     OR h.total_commission_cents < 0 OR h.commission_vat_cents < 0
     OR h.total_commission_cents + h.commission_vat_cents <> commission
     OR h.total_net_cents <> net - h.courier_fee_cents THEN
    RAISE EXCEPTION 'Invoice totals do not match lines';
  END IF;

  -- Lock source orders before invoice numbering, with the same order as cancellation.
  PERFORM 1 FROM public.orders WHERE id IN (SELECT l.order_id FROM jsonb_populate_recordset(NULL::public.invoice_lines,p_lines) l) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.invoice_lines,p_lines) l LEFT JOIN public.orders o ON o.id=l.order_id
    WHERE o.id IS NULL OR o.lifecycle_version IS DISTINCT FROM 'marketplace-v1'
      OR o.payment_status IS DISTINCT FROM 'paid' OR o.paid_at IS NULL OR o.status='cancelled'
      OR o.payment_review_reason IS NOT NULL OR o.financial_snapshot->>'requires_review' IS DISTINCT FROM 'false'
      OR o.financial_snapshot->>'operator_version' IS DISTINCT FROM h.operator_version
      OR o.financial_snapshot->'operator' IS DISTINCT FROM h.operator_snapshot
      OR NOT h.seller_id=ANY(o.seller_ids)) THEN
    RAISE EXCEPTION 'Source order requires financial reconciliation';
  END IF;
  -- The zero-argument number generator and both inserts share this transaction.
  -- Any header/line/FK/unique/trigger error rolls back the whole operation.
  v_invoice_number := public.next_invoice_number();
  INSERT INTO public.invoices (
    invoice_number, seller_id, period_start, period_end, total_gross_cents,
    total_ex_vat_cents, total_product_vat_cents, total_commission_cents,
    commission_vat_rate, commission_vat_cents, courier_fee_cents,
    courier_order_count, total_net_cents, seller_legal_name, seller_reg_number,
    seller_vat_number, seller_legal_address, seller_bank_name, seller_bank_iban,
    operator_version, operator_snapshot, status
  ) VALUES (
    v_invoice_number, h.seller_id, h.period_start, h.period_end, h.total_gross_cents,
    h.total_ex_vat_cents, h.total_product_vat_cents, h.total_commission_cents,
    h.commission_vat_rate, h.commission_vat_cents, h.courier_fee_cents,
    h.courier_order_count, h.total_net_cents, h.seller_legal_name, h.seller_reg_number,
    h.seller_vat_number, h.seller_legal_address, h.seller_bank_name, h.seller_bank_iban,
    h.operator_version, h.operator_snapshot, 'draft'
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_lines (
    invoice_id, order_id, order_number, order_date, product_title, quantity, unit,
    unit_price_cents, line_gross_cents, vat_rate, vat_amount_cents, ex_vat_cents,
    commission_rate, commission_cents, net_cents, line_order
  )
  SELECT v_invoice_id, l.order_id, l.order_number, l.order_date, l.product_title,
    l.quantity, l.unit, l.unit_price_cents, l.line_gross_cents, l.vat_rate,
    l.vat_amount_cents, l.ex_vat_cents, l.commission_rate, l.commission_cents,
    l.net_cents, l.line_order
  FROM jsonb_populate_recordset(NULL::public.invoice_lines, p_lines) l;
  RETURN jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_number);
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_invoice_ready_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_create_invoice_v1(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_invoice_ready_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_create_invoice_v1(jsonb, jsonb) TO service_role;

COMMIT;
