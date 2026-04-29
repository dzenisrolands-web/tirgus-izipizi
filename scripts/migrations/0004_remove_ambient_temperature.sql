-- Migration 0004: Remove ambient temperature regime
-- Date: 2026-04-29
-- Marketplace nepiedāvā istabas temperatūras piegādi — visi produkti
-- pārceļ uz "chilled" (dzesēts +2°C – +6°C).
--
-- Idempotenta — ja palaiž atkārtoti, vienkārši nemaina nevienu rindu.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. listings: ambient → chilled
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE listings
SET storage_type = 'chilled', updated_at = now()
WHERE storage_type = 'ambient';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. hot_drops: ambient → chilled
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE hot_drops
SET temperature_zone = 'chilled', updated_at = now()
WHERE temperature_zone = 'ambient';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pievieno CHECK constraints, lai nākotnē nevarētu ievietot 'ambient'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_storage_type_valid;
ALTER TABLE listings
  ADD CONSTRAINT listings_storage_type_valid
  CHECK (storage_type IS NULL OR storage_type IN ('chilled', 'frozen'));

ALTER TABLE hot_drops
  DROP CONSTRAINT IF EXISTS hot_drops_temperature_zone_valid;
ALTER TABLE hot_drops
  ADD CONSTRAINT hot_drops_temperature_zone_valid
  CHECK (temperature_zone IN ('chilled', 'frozen'));

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE.
-- ─────────────────────────────────────────────────────────────────────────────
