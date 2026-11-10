-- Disposable fixture only: original sellers row has a synthetic pickup address.
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sellers_public WHERE courier_pickup_address IS NOT NULL) THEN
    RAISE EXCEPTION 'Private pickup address leaked through public seller view';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sellers_public WHERE id = 'fixture-seller' AND name = 'Public farm') THEN
    RAISE EXCEPTION 'Safe public seller fields disappeared';
  END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sellers WHERE id = 'fixture-seller' AND courier_pickup_address = 'Synthetic private pickup address') THEN
    RAISE EXCEPTION 'Private source data was unexpectedly rewritten';
  END IF;
END;
$$;
ROLLBACK;
