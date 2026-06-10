-- Migration 0025: Full-text + trigram product search
-- Enables fuzzy matching, typo tolerance, and diacritic-insensitive search.
-- Run in Supabase SQL Editor.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. IMMUTABLE wrapper for unaccent (needed for index expressions)
-- Default unaccent() is STABLE, which Postgres won't allow in an index.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE STRICT;

-- 3. GIN trigram indexes on normalized text
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON listings USING GIN (public.immutable_unaccent(lower(title)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_category_trgm
  ON listings USING GIN (public.immutable_unaccent(lower(category)) gin_trgm_ops);

-- 4. Search RPC function
CREATE OR REPLACE FUNCTION public.search_products(
  query text,
  lim int DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  price numeric,
  unit text,
  image_url text,
  category text,
  seller_id uuid,
  seller_name text,
  seller_farm_name text,
  seller_avatar text,
  seller_location text,
  relevance real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  norm_q text;
BEGIN
  -- Normalize query: strip diacritics + lowercase
  norm_q := public.immutable_unaccent(lower(trim(query)));

  -- Empty query → no results
  IF norm_q = '' OR length(norm_q) < 2 THEN
    RETURN;
  END IF;

  -- Set similarity threshold low enough for typo tolerance
  PERFORM set_config('pg_trgm.similarity_threshold', '0.15', true);

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.slug,
    l.price,
    l.unit,
    l.image_url,
    l.category,
    l.seller_id,
    s.name AS seller_name,
    COALESCE(s.farm_name, s.name) AS seller_farm_name,
    COALESCE(s.logo_url, s.avatar_url, '') AS seller_avatar,
    COALESCE(s.location, '') AS seller_location,
    (
      -- Title similarity (primary signal, weight 3x)
      similarity(public.immutable_unaccent(lower(l.title)), norm_q) * 3.0
      -- Bonus if title starts with query
      + CASE WHEN public.immutable_unaccent(lower(l.title)) LIKE norm_q || '%' THEN 2.0 ELSE 0.0 END
      -- Bonus if title contains exact query
      + CASE WHEN public.immutable_unaccent(lower(l.title)) LIKE '%' || norm_q || '%' THEN 1.0 ELSE 0.0 END
      -- Category similarity (secondary)
      + similarity(public.immutable_unaccent(lower(l.category)), norm_q) * 0.5
      -- Seller name similarity
      + similarity(public.immutable_unaccent(lower(COALESCE(s.farm_name, s.name, ''))), norm_q) * 0.8
    )::real AS relevance
  FROM listings l
  LEFT JOIN sellers s ON s.id = l.seller_id
  WHERE l.status = 'active'
    AND l.image_url IS NOT NULL
    AND l.image_url != ''
    AND l.price > 0
    AND (
      -- Trigram match on title (primary)
      public.immutable_unaccent(lower(l.title)) % norm_q
      -- OR trigram match on category
      OR public.immutable_unaccent(lower(l.category)) % norm_q
      -- OR substring match (handles "med" → "medus", short queries)
      OR public.immutable_unaccent(lower(l.title)) LIKE '%' || norm_q || '%'
      -- OR seller name match
      OR public.immutable_unaccent(lower(COALESCE(s.farm_name, s.name, ''))) % norm_q
      OR public.immutable_unaccent(lower(COALESCE(s.farm_name, s.name, ''))) LIKE '%' || norm_q || '%'
    )
  ORDER BY relevance DESC
  LIMIT lim;
END;
$$;
