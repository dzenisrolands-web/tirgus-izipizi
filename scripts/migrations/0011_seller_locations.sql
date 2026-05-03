-- Migration 0011: Sellers — refine location field to specific city
-- Date: 2026-05-02
-- Idempotent — safe to re-run.
--
-- Context: listing cards show "no <location>" as a provenance signal. Generic
-- region values like "Vidzemes novads" / "Pierīgas novads" are vague; users
-- want specific cities. Sourced from seller descriptions + Dzenis confirmations.
--
-- Already correct (no UPDATE):
--   austeru bārs BURŽUJS = Rīga · Cake Break = Suntaži · Oranžās Bumbas = Rīga

UPDATE sellers SET location = 'Sigulda'  WHERE name ILIKE 'K/S%Ekoloģisks%';
UPDATE sellers SET location = 'Melnsils' WHERE name ILIKE 'WILD%FREE%';
UPDATE sellers SET location = 'Krimulda' WHERE name = 'Bujums';
