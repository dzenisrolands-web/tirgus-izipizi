-- Retain historical records; reject only new selections of the closed Tukums locker.
-- Apply after reviewing in staging. This migration does not rewrite existing rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.reject_retired_locker_selection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_row jsonb := to_jsonb(NEW);
  previous_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  selected text;
  previous text;
BEGIN
  IF TG_TABLE_NAME = 'sellers' THEN
    IF coalesce(next_row->'home_locker_ids', '[]'::jsonb) ? 'tukums'
       AND (TG_OP = 'INSERT' OR next_row->'home_locker_ids' IS DISTINCT FROM previous_row->'home_locker_ids') THEN
      RAISE EXCEPTION 'Tukuma pakomāts ir slēgts. Izvēlieties citu nodošanas vietu.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    selected := next_row #>> '{delivery_info,locker_id}';
    previous := previous_row #>> '{delivery_info,locker_id}';
  ELSIF TG_TABLE_NAME = 'hot_drops' THEN
    selected := next_row->>'pickup_locker_id';
    previous := previous_row->>'pickup_locker_id';
  ELSIF TG_TABLE_NAME = 'hot_drop_reservations' THEN
    selected := next_row->>'delivery_locker_id';
    previous := previous_row->>'delivery_locker_id';
  ELSE
    selected := next_row->>'locker_id';
    previous := previous_row->>'locker_id';
  END IF;

  IF selected = 'tukums' AND (TG_OP = 'INSERT' OR selected IS DISTINCT FROM previous) THEN
    RAISE EXCEPTION 'Tukuma pakomāts ir slēgts. Izvēlieties citu saņemšanas vietu.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['sellers', 'listings', 'hot_drops', 'hot_drop_reservations', 'orders', 'locker_subscriptions'] LOOP
    IF to_regclass('public.' || relation_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS reject_retired_locker ON public.%I', relation_name);
      EXECUTE format(
        'CREATE TRIGGER reject_retired_locker BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_retired_locker_selection()',
        relation_name
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
