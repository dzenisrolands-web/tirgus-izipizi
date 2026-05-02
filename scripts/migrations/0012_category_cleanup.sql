-- Migration 0012: Listings — category cleanup + new "Mērces" category
-- Date: 2026-05-02
-- Idempotent — safe to re-run.
--
-- Context: audit of /catalog?category=Konservi found 4 misclassified items.
-- Also unifies "Konditorejas" → "Konditorija" (homepage chip mismatch with DB).
-- Introduces new category "Mērces" for ketchup et al.

UPDATE listings SET category = 'Gaļa'        WHERE title ILIKE '%medniekdesiņas%';
UPDATE listings SET category = 'Garšaugi'    WHERE title ILIKE 'Garšvielu maisījums%';
UPDATE listings SET category = 'Konditorija' WHERE title ILIKE '%marmelādes%';
UPDATE listings SET category = 'Mērces'      WHERE title ILIKE '%Ketčups%';

-- Unify naming: any leftover "Konditorejas" → "Konditorija"
UPDATE listings SET category = 'Konditorija' WHERE category = 'Konditorejas';
