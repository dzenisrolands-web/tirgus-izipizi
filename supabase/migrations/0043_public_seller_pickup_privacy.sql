-- Buyer fees no longer depend on a seller's private courier pickup address.
-- Keep the column name/type for deployed-client compatibility, but never expose its value.
-- Existing private sellers rows are not changed.
BEGIN;
CREATE OR REPLACE VIEW public.sellers_public AS
SELECT
  id, status, name, farm_name, location, description, short_desc,
  avatar_url, cover_url, logo_url, youtube_video_url, youtube_video_id,
  website, facebook, instagram, tiktok, youtube_channel, rating, review_count,
  verified, approved_at, created_at, updated_at, slug, quote_text, quote_author,
  home_locker_ids, facts, milestones, events, delivery_mode,
  NULL::text AS courier_pickup_address
FROM public.sellers;

REVOKE ALL ON public.sellers_public FROM PUBLIC;
GRANT SELECT ON public.sellers_public TO anon, authenticated;
COMMENT ON VIEW public.sellers_public IS
  'Public seller profile fields only; private courier_pickup_address is deliberately masked as NULL. Never add banking, personal contacts or internal notes.';
NOTIFY pgrst, 'reload schema';
COMMIT;
