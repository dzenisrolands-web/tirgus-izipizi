-- Migration 0032: RLS lockdown, nobeigums pēc 0030
-- Date: 2026-09-30
--
-- KONTEKSTS
-- 0030 izpildes rezultāts ražošanā (verify-rls-lockdown.mjs): orders, profiles,
-- invitations, email_subscribers, email_templates lasīšana aizvērta, bet
-- `sutijumi` un `seller_followers` joprojām lasāmas anonīmi, un anon loma
-- joprojām var izpildīt UPDATE uz orders, pakomati, compartments.
--
-- CĒLONIS
-- 1) Postgres RLS politikas ir permisīvas: ja KĀDA politika atļauj, piekļuve
--    ir atļauta. 0030 dzēsa politikas pēc pieņemtajiem nosaukumiem, bet šajās
--    tabulās vecās politikas saucas citādi un palika spēkā.
-- 2) anon lomai joprojām ir piešķirtas INSERT/UPDATE/DELETE tiesības uz
--    tabulām (GRANT). Tas ir otrs slānis zem RLS — ja tiesību nav, PostgREST
--    atbild 401/403 un RLS pat netiek izvērtēta.
--
-- RISINĀJUMS
-- a) Dzēst VISAS politikas, kas attiecas uz anon vai public, nepaļaujoties uz
--    nosaukumiem. Politikas `TO authenticated` netiek aiztiktas.
-- b) Atjaunot paredzētās politikas (tās pašas, kas 0030).
-- c) Atņemt anon lomai GRANT tiesības, kuras tai nekad nevajadzēja.
--
-- PĀRBAUDĪTS KODĀ, ka neviens legitīms ceļš nerakstā šajās tabulās ar anon:
--   * pasūtījumu izveide  — /api/checkout/create-session, SUPABASE_SECRET_KEY
--   * pasūtījumu statusi  — ražotājs/admins ar savu sesiju (role authenticated)
--   * /admin/pakomati     — ielogots admins (role authenticated)
--   * sekojumi            — ielogots lietotājs (role authenticated)
--
-- Idempotenta — droši atkārtot.

-- ─────────────────────────────────────────────────────────────────────────────
-- a) Dzēst visas anon/public politikas uz skartajām tabulām
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('orders', 'pakomati', 'compartments', 'sutijumi', 'seller_followers')
       AND roles && ARRAY['anon', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Dzēsta politika % uz %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- b) Atjaunot paredzētās politikas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pakomati         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sutijumi         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_followers ENABLE ROW LEVEL SECURITY;

-- Pakomātu saraksts ir publisks (pircējam jāredz pakomāti), rakstīt drīkst admins.
DROP POLICY IF EXISTS pakomati_public_read ON public.pakomati;
CREATE POLICY pakomati_public_read ON public.pakomati
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS pakomati_admin_write ON public.pakomati;
CREATE POLICY pakomati_admin_write ON public.pakomati
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compartments_public_read ON public.compartments;
CREATE POLICY compartments_public_read ON public.compartments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS compartments_admin_write ON public.compartments;
CREATE POLICY compartments_admin_write ON public.compartments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- sutijumi — tikai admins.
DROP POLICY IF EXISTS sutijumi_admin_all ON public.sutijumi;
CREATE POLICY sutijumi_admin_all ON public.sutijumi
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- seller_followers — lietotājs pārvalda savus sekojumus, admins visus.
DROP POLICY IF EXISTS seller_followers_own ON public.seller_followers;
CREATE POLICY seller_followers_own ON public.seller_followers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS seller_followers_admin_all ON public.seller_followers;
CREATE POLICY seller_followers_admin_all ON public.seller_followers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- orders politikas (0030) — atjaunojam, ja kāda tika dzēsta pie (a).
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR buyer_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  );

DROP POLICY IF EXISTS orders_seller_select ON public.orders;
CREATE POLICY orders_seller_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    seller_ids && ARRAY(
      SELECT id::text FROM public.sellers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS orders_seller_update ON public.orders;
CREATE POLICY orders_seller_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    seller_ids && ARRAY(
      SELECT id::text FROM public.sellers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS orders_admin_all ON public.orders;
CREATE POLICY orders_admin_all ON public.orders
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- c) Atņemt anon lomai tiesības, kuras tai nekad nevajadzēja
-- ─────────────────────────────────────────────────────────────────────────────
-- Publiski lasāmajām tabulām atņemam tikai rakstīšanu.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pakomati     FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.compartments FROM anon;

-- Privātajām tabulām anon nevajag neko.
REVOKE ALL ON public.orders             FROM anon;
REVOKE ALL ON public.sutijumi           FROM anon;
REVOKE ALL ON public.seller_followers   FROM anon;
REVOKE ALL ON public.profiles           FROM anon;
REVOKE ALL ON public.invitations        FROM anon;
REVOKE ALL ON public.email_subscribers  FROM anon;
REVOKE ALL ON public.email_templates    FROM anon;
REVOKE ALL ON public.franchise_partners FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kontrole: atlikušās politikas uz skartajām tabulām (redzamas rezultātu tabulā)
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT tablename, policyname, cmd, roles
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('orders', 'pakomati', 'compartments', 'sutijumi', 'seller_followers')
 ORDER BY tablename, policyname;
