-- Migration 0029: Return real created_at from search_products
--
-- Problem: search_products() never returned the listing's created_at, so
-- app/catalog/page.tsx's mapRpcToListing() faked it with `new Date()` for
-- every search result. This made the "Jaunākie" (newest) sort meaningless
-- whenever a search query was active — all results appeared to have the
-- exact same (fake, "now") creation time.
--
-- Fix: add l.created_at to the function's return columns so the catalog can
-- sort search results by their real creation date, same as the unfiltered
-- catalog view.
--
-- Postgres requires DROP + CREATE (not just CREATE OR REPLACE) when the
-- RETURNS TABLE column list changes. Safe to re-run.

DROP FUNCTION IF EXISTS public.search_products(text, int);

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
  created_at timestamptz,
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
    l.created_at,
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

NOTIFY pgrst, 'reload schema';
