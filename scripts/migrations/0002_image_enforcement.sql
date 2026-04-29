-- Migration 0002: Enforce image requirement on listings
-- Date: 2026-04-29
-- Run after 0001. Idempotent — safe to re-run.
--
-- 1. Notify each affected seller about their listing being deactivated
-- 2. Deactivate (pause) listings without an image
-- 3. Add trigger to prevent activating image-less listings in the future

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Insert notifications BEFORE pausing (so we can find affected listings via WHERE)
--    Uses ON CONFLICT to be safe if notifications table has unique constraints.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO notifications (user_id, title, message, listing_id)
SELECT
  user_id,
  '⚠️ Produkts deaktivizēts — nav bildes',
  'Produkts "' || title || '" ir automātiski deaktivizēts, jo tam nav pievienota bilde. Pievieno bildi profila redaktorā un iesniedz produktu atkārtoti, lai tas atkal kļūtu redzams pircējiem.',
  id
FROM listings
WHERE (image_url IS NULL OR image_url = '')
  AND status IN ('active', 'pending_review');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pause all listings without image
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE listings
SET status = 'paused', updated_at = now()
WHERE (image_url IS NULL OR image_url = '')
  AND status IN ('active', 'pending_review');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger — auto-pause any listing that is set to 'active' without image
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_listing_has_image()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.image_url IS NULL OR NEW.image_url = '')
     AND NEW.status = 'active' THEN
    NEW.status := 'paused';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_image ON listings;
CREATE TRIGGER listings_enforce_image
BEFORE INSERT OR UPDATE OF image_url, status ON listings
FOR EACH ROW
EXECUTE FUNCTION enforce_listing_has_image();
