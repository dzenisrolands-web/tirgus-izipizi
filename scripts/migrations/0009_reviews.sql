-- Migration 0009: Reviews table with verified purchase flag
-- Date: 2026-05-02
-- Idempotent — safe to re-run.
--
-- Recenzijas — pircējs vērtē produktu pēc saņemšanas (1–5 zvaigznes + komentārs).
-- "Verified purchase" zīme parādās, ja review ir saistīts ar reālu paid order.
--
-- Šī migrācija strādā arī ja `reviews` tabula jau eksistē ar veco shēmu —
-- ALTER TABLE pievieno trūkstošās kolonnas IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_name   text NOT NULL,
  stars        integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      text NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- Pievieno trūkstošās kolonnas (ja jau eksistēja agrāk bez tām)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS seller_id         uuid REFERENCES sellers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS buyer_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id          uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false NOT NULL;

-- Konstanti
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_comment_min_length;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_comment_min_length
  CHECK (length(trim(comment)) >= 10);

ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_buyer_name_required;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_buyer_name_required
  CHECK (length(trim(buyer_name)) >= 1);

-- Indeksi
CREATE UNIQUE INDEX IF NOT EXISTS reviews_buyer_listing_uniq
  ON reviews (buyer_id, listing_id) WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_listing_idx ON reviews (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_seller_idx  ON reviews (seller_id, created_at DESC);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select_all ON reviews;
CREATE POLICY reviews_select_all ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS reviews_insert_own ON reviews;
CREATE POLICY reviews_insert_own ON reviews FOR INSERT WITH CHECK (
  buyer_id IS NULL OR buyer_id = auth.uid()
);

DROP POLICY IF EXISTS reviews_update_own ON reviews;
CREATE POLICY reviews_update_own ON reviews FOR UPDATE USING (
  buyer_id = auth.uid()
) WITH CHECK (
  buyer_id = auth.uid()
);

DROP POLICY IF EXISTS reviews_delete_own ON reviews;
CREATE POLICY reviews_delete_own ON reviews FOR DELETE USING (
  buyer_id = auth.uid()
);

-- Aizpilda seller_id eksistējošajām atsauksmēm
UPDATE reviews r
SET seller_id = l.seller_id
FROM listings l
WHERE r.listing_id = l.id AND r.seller_id IS NULL;

-- Helpers
CREATE OR REPLACE FUNCTION listing_avg_rating(p_listing_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(AVG(stars)::numeric(3,2), 0) AS avg_rating,
    COUNT(*) AS review_count
  FROM reviews
  WHERE listing_id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION seller_avg_rating(p_seller_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(AVG(stars)::numeric(3,2), 0) AS avg_rating,
    COUNT(*) AS review_count
  FROM reviews
  WHERE seller_id = p_seller_id;
$$;

NOTIFY pgrst, 'reload schema';
