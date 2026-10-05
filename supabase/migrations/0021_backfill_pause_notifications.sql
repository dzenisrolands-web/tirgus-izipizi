-- Migration 0021: backfill notifications for auto-paused listings.
--
-- Migration 0002 only notified about image-less listings (and only at the time
-- it ran). Migration 0017 paused price=0 listings without inserting any
-- notification at all, so 8 sellers had products silently disabled.
--
-- This migration retroactively inserts:
--   1. A "produkts deaktivizēts" notification for each affected seller
--      (skips sellers whose auth user_id isn't set yet — those legacy sellers
--       haven't logged in).
--   2. An "auto-pauzēts produkts" notification for every super-admin so they
--      can see the alert in /admin.
--
-- Idempotent — re-running is a no-op because of the NOT EXISTS guards.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Notify each seller about each of their paused listings
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO notifications (user_id, title, message, listing_id)
SELECT
  s.user_id,
  CASE WHEN (l.image_url IS NULL OR l.image_url = '')
       THEN '⚠️ Produkts deaktivizēts — nav bildes'
       ELSE '⚠️ Produkts deaktivizēts — cena nav norādīta'
  END AS title,
  'Produkts "' || l.title || '" ir pauzēts un netiek rādīts pircējiem. ' ||
  CASE WHEN (l.image_url IS NULL OR l.image_url = '')
       THEN 'Pievieno bildi profilā un atvieto produktu.'
       ELSE 'Ievadi cenu (lielāku par 0 €) un saglabā, lai atjaunotu.'
  END AS message,
  l.id AS listing_id
FROM listings l
JOIN sellers s ON s.id = l.seller_id
WHERE l.status = 'paused'
  AND ((l.image_url IS NULL OR l.image_url = '') OR (l.price IS NULL OR l.price = 0))
  AND s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = s.user_id
      AND n.listing_id = l.id
      AND n.title LIKE '%deaktiviz%'
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2. Notify every super-admin about every paused listing
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO notifications (user_id, title, message, listing_id)
SELECT
  p.id AS user_id,
  '🛑 Auto-pauzēts produkts' AS title,
  'Produkts "' || l.title || '" no ražotāja "' || COALESCE(s.name, 'nezināms') ||
    '" ir pauzēts: ' ||
    CASE WHEN (l.image_url IS NULL OR l.image_url = '')
         THEN 'nav bildes'
         ELSE 'cena nav norādīta'
    END AS message,
  l.id AS listing_id
FROM listings l
LEFT JOIN sellers s ON s.id = l.seller_id
CROSS JOIN profiles p
WHERE l.status = 'paused'
  AND ((l.image_url IS NULL OR l.image_url = '') OR (l.price IS NULL OR l.price = 0))
  AND p.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = p.id
      AND n.listing_id = l.id
      AND n.title LIKE '%Auto-pauz%'
  );

-- ─────────────────────────────────────────────────────────────────────
-- 3. Trigger: future auto-pauses notify both sides automatically
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_listing_pause()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_user_id uuid;
  v_seller_name    text;
  v_reason         text;
  v_seller_title   text;
  v_seller_message text;
  v_admin_message  text;
  admin_id         uuid;
BEGIN
  -- Determine why the listing got paused
  IF NEW.image_url IS NULL OR NEW.image_url = '' THEN
    v_reason := 'no_image';
  ELSIF NEW.price IS NULL OR NEW.price = 0 THEN
    v_reason := 'no_price';
  ELSE
    v_reason := 'manual';
  END IF;

  SELECT user_id, COALESCE(farm_name, name)
    INTO v_seller_user_id, v_seller_name
    FROM sellers WHERE id = NEW.seller_id;

  IF v_reason = 'no_image' THEN
    v_seller_title   := '⚠️ Produkts deaktivizēts — nav bildes';
    v_seller_message := 'Produkts "' || NEW.title || '" ir pauzēts. Pievieno bildi un atvieto produktu.';
    v_admin_message  := 'Produkts "' || NEW.title || '" no ražotāja "' || COALESCE(v_seller_name, 'nezināms') || '" ir pauzēts: nav bildes';
  ELSIF v_reason = 'no_price' THEN
    v_seller_title   := '⚠️ Produkts deaktivizēts — cena nav norādīta';
    v_seller_message := 'Produkts "' || NEW.title || '" ir pauzēts. Ievadi cenu (lielāku par 0 €) un saglabā.';
    v_admin_message  := 'Produkts "' || NEW.title || '" no ražotāja "' || COALESCE(v_seller_name, 'nezināms') || '" ir pauzēts: cena nav norādīta';
  ELSE
    v_seller_title   := NULL; -- manual pause: seller did it themselves, no point notifying them
    v_admin_message  := 'Produkts "' || NEW.title || '" no ražotāja "' || COALESCE(v_seller_name, 'nezināms') || '" tika manuāli pauzēts';
  END IF;

  IF v_seller_user_id IS NOT NULL AND v_seller_title IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, listing_id)
    VALUES (v_seller_user_id, v_seller_title, v_seller_message, NEW.id);
  END IF;

  FOR admin_id IN SELECT id FROM profiles WHERE role = 'super_admin' LOOP
    INSERT INTO notifications (user_id, title, message, listing_id)
    VALUES (admin_id, '🛑 Auto-pauzēts produkts', v_admin_message, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_listing_pause ON listings;
CREATE TRIGGER trg_notify_on_listing_pause
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (NEW.status = 'paused' AND OLD.status IS DISTINCT FROM 'paused')
  EXECUTE FUNCTION notify_on_listing_pause();
