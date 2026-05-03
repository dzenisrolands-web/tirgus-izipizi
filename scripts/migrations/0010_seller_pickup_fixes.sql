-- Migration 0010: Sellers — fix pickup locations for Cake Break and austeru bārs BURŽUJS
-- Date: 2026-05-02
-- Idempotent — safe to re-run.
--
-- Context (per Dzenis 2026-05-02):
--   - Cake Break drops at Brīvības iela 253 pakomāts (was empty in DB).
--   - austeru bārs BURŽUJS does NOT self-drop at any pakomāts. Courier always
--     picks up from the restaurant in Berga bazārs (Dzirnavu 84, Rīga). Buyers
--     can still choose pakomāts delivery, but logistics is courier → restaurant
--     → pakomāts.
--
-- Other sellers already have correct home_locker_ids:
--   WILD'N'FREE → agenskalna · Oranžās Bumbas → agenskalna ·
--   Bujums → agenskalna · K/S Ekoloģisks.lv → brivibas

UPDATE sellers
   SET home_locker_ids = ARRAY['brivibas']
 WHERE name = 'Cake Break'
   AND (home_locker_ids IS NULL OR cardinality(home_locker_ids) = 0);

UPDATE sellers
   SET home_locker_ids        = ARRAY[]::text[],
       courier_pickup_address = 'Dzirnavu 84, Rīga (Berga Bazārs)'
 WHERE name ILIKE 'austeru%BURŽUJS%';

NOTIFY pgrst, 'reload schema';
