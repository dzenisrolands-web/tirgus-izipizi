-- Migration 0031: Franšīzes daļu sistēma
-- Date: 2026-09-30
--
-- IZCELSME
-- Pārnesta no `izipizi` monorepo (`supabase/migrations/0004_franchise_shares.sql`),
-- kur tā palika necommitota un nekad netika izpildīta. Monorepo 0003 jau ir
-- izpildīta šajā datubāzē (pakomati.image_url, capabilities, working_hours,
-- description un franchise_applications eksistē), tāpēc šeit ir tikai 0004 daļa.
--
-- KĀPĒC TAS IR VAJADZĪGS
-- `/admin/pakomati` jau lasa total_shares, share_price_eur, revenue_split_pct un
-- franchise_shares. Šo kolonnu un tabulas nav, tāpēc kods klusējot atkāpjas uz
-- noklusējumiem un franšīzes daļu pārvaldība ražošanā nedarbojas.
--
-- ATŠĶIRĪBAS NO ORIĢINĀLA
-- 1. Oriģinālā politikas lietoja `has_role('admin')`, kas balstās uz `user_roles`
--    tabulu. Tā vēl nav aizpildīta, tāpēc tādas politikas šobrīd liegtu piekļuvi
--    visiem. Lietojam `is_super_admin()` no migrācijas 0030 — tā lasa JWT
--    app_metadata un strādā jau tagad.
-- 2. Oriģināls padarīja `franchise_shares` publiski lasāmu. Tur ir price_paid un
--    partnera identitāte — komercdati. Šeit tie ir tikai adminam un pašam
--    partnerim. Ja vēlāk vajag publisku franšīzes lapu, jāveido šaurs skats ar
--    brīvo daļu procentu, bez cenām un partneru vārdiem.
--
-- Idempotenta — droši atkārtot.
-- Priekšnosacījums: 0030 (tur definēta is_super_admin()).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Pakomāti — franšīzes konfigurācija
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pakomati
  ADD COLUMN IF NOT EXISTS total_shares      int           NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS share_price_eur   numeric(10,2) NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS revenue_split_pct numeric(5,2)  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS compartment_config jsonb        DEFAULT '{"M":6,"L":2,"XL":3}';

-- share_price_eur noklusējums: 50% = 50 × 400 = 20 000 €. Maināms katram pakomātam.
-- revenue_split_pct: cik % no apgrozījuma dala ar daļu turētājiem.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Franšīzes partneri — papildu lauki
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.franchise_partners
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio        text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'aktivs';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Daļu tabula — vairāki partneri vienam pakomātam
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.franchise_shares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pakomats_id  uuid NOT NULL REFERENCES public.pakomati(id)           ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,
  shares_pct   numeric(5,2) NOT NULL CHECK (shares_pct > 0 AND shares_pct <= 100),
  price_paid   numeric(10,2),
  note         text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pakomats_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_franchise_shares_pakomats ON public.franchise_shares(pakomats_id);
CREATE INDEX IF NOT EXISTS idx_franchise_shares_partner  ON public.franchise_shares(partner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Kopsavilkuma skats — adminam
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.pakomati_franchise_summary AS
SELECT
  p.id AS pakomats_id,
  p.code,
  p.name,
  p.total_shares,
  p.share_price_eur,
  p.revenue_split_pct,
  COALESCE(SUM(fs.shares_pct), 0)                   AS sold_pct,
  p.total_shares - COALESCE(SUM(fs.shares_pct), 0)  AS free_pct,
  COALESCE(SUM(fs.price_paid), 0)                   AS total_revenue,
  COUNT(fs.id)                                      AS partner_count
FROM public.pakomati p
LEFT JOIN public.franchise_shares fs ON fs.pakomats_id = p.id
GROUP BY p.id, p.code, p.name, p.total_shares, p.share_price_eur, p.revenue_split_pct;

-- Skats satur total_revenue — komercdati. Nedodam anon lomai.
REVOKE ALL ON public.pakomati_franchise_summary FROM anon;
GRANT SELECT ON public.pakomati_franchise_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Brīvo daļu aprēķins
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pakomat_free_shares(p_pakomats_id uuid)
RETURNS TABLE (
  free_pct          numeric,
  price_per_pct     numeric,
  min_purchase_eur  numeric,
  full_purchase_eur numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.total_shares - COALESCE(SUM(fs.shares_pct), 0)                        AS free_pct,
    p.share_price_eur                                                       AS price_per_pct,
    p.share_price_eur                                                       AS min_purchase_eur,
    (p.total_shares - COALESCE(SUM(fs.shares_pct), 0)) * p.share_price_eur  AS full_purchase_eur
  FROM public.pakomati p
  LEFT JOIN public.franchise_shares fs ON fs.pakomats_id = p.id
  WHERE p.id = p_pakomats_id
  GROUP BY p.id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — admins pārvalda, partneris redz savas daļas, anon neredz neko
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.franchise_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS franchise_shares_public_read  ON public.franchise_shares;
DROP POLICY IF EXISTS franchise_shares_admin_all    ON public.franchise_shares;
DROP POLICY IF EXISTS franchise_shares_partner_read ON public.franchise_shares;

CREATE POLICY franchise_shares_admin_all ON public.franchise_shares
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY franchise_shares_partner_read ON public.franchise_shares
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.franchise_partners WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Franšīzes pieteikumi — iesniegt drīkst jebkurš, lasīt tikai admins.
--    Tabula jau eksistē (monorepo 0003), šeit tikai sakārtojam politikas.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.franchise_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS franchise_app_insert      ON public.franchise_applications;
DROP POLICY IF EXISTS franchise_app_auth_insert ON public.franchise_applications;
DROP POLICY IF EXISTS franchise_app_admin_read  ON public.franchise_applications;

CREATE POLICY franchise_app_insert ON public.franchise_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY franchise_app_admin_read ON public.franchise_applications
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

NOTIFY pgrst, 'reload schema';
