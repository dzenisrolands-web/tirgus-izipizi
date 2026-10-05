-- Migration 0037: aizvērt "ikviens drīkst rakstīt" politikas
-- Date: 2026-10-05
--
-- KONTEKSTS (supabase/diagnostics/write_exposure.sql, ražošana pēc 0036)
-- 0036 atņēma anon rakstīšanas tiesības, un diagnostika apstiprināja, ka anon
-- ir tikai INSERT uz pwa_events. Bet vairākām tabulām ir politikas ar
-- roles = {public}, using/check = true, kas ir spēkā REĢISTRĒTIEM lietotājiem
-- (konta izveide ir bez maksas), tāpēc jebkurš ar kontu var:
--   listings         — mainīt cenu / dzēst / izveidot jebkuru produktu
--   weekly_featured  — pats piešķirt sev "nedēļas piedāvājumu" vai dzēst citus
--   profiles         — INSERT/UPDATE jebkurš profils (ierobežo tikai 0030 SELECT)
--   sutijumi         — `auth_update` (authenticated, true)
--   email_subscribers— insert_all / delete_own (true)
--
-- KAS PĀRBAUDĪTS KODĀ (ražotāja un admin plūsmas turpina strādāt)
--  * Ražotājs: produktu izveide/maiņa/dzēšana pēc savas seller_id
--    (components/product-form.tsx, app/dashboard/produkti/page.tsx).
--    Izpētīts: listings.seller_id ir visiem produktiem (0 rindu ar NULL).
--  * Ražotājs: pieteikums nedēļas piedāvājumam sūta status 'pending' un savu
--    seller_id (app/dashboard/produkti/page.tsx:115).
--  * Admin: listings/weekly_featured maiņa un apstiprināšana ar savu sesiju
--    (app/admin/produkti, app/admin/nedelas-piedavajums) — superadmins.
--  * profiles, sutijumi, email_subscribers: 0030 jau izveidoja paredzētās
--    "sava rinda / admin" politikas; tās paliek.
--  * SELECT politikas uz listings/weekly_featured NETIEK aiztiktas, tāpēc
--    publiskā lasīšana nemainās.
--
-- KAS PALIEK ATVĒRTS (apzināti, ārpus šīs migrācijas)
--  * feedback "anyone can insert", franchise_applications, invitations anon
--    politikas: anon tiesību tiem vairs nav (0036); atstātas, lai neko
--    nesalauztu, ja tiek izmantotas ar citu ceļu.
--  * profiles/sellers: lietotājs var mainīt savus jutīgos laukus
--    (free_delivery_credits, role, status). Prasa trigeri vai kolonnu tiesības.
--  * user_roles lasāma visiem (user_roles_public_read). Tabula pašlaik tukša.
--
-- Atritināšana: supabase/rollbacks/0037_rollback.sql
-- Idempotenta — droši atkārtot.

-- ─────────────────────────────────────────────────────────────────────────────
-- listings + weekly_featured: dzēst VISAS rakstīšanas politikas (INSERT/UPDATE/
-- DELETE/ALL), SELECT politikas atstāt
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('listings', 'weekly_featured')
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Dzēsta politika % uz %', r.policyname, r.tablename;
  END LOOP;
END $$;

ALTER TABLE public.listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_featured ENABLE ROW LEVEL SECURITY;

-- listings: ražotājs pārvalda tikai savus produktus (ALL ietver arī SELECT,
-- tāpēc ražotājs redz savus melnrakstus/pauzētos); superadmins visus.
CREATE POLICY listings_owner_all ON public.listings
  FOR ALL TO authenticated
  USING      (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY listings_admin_all ON public.listings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- weekly_featured: ražotājs var pieteikties tikai savam produktam un tikai kā
-- 'pending' (nevar pats sev uzlikt 'active'); admins apstiprina.
CREATE POLICY weekly_featured_owner_insert ON public.weekly_featured
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY weekly_featured_owner_update ON public.weekly_featured
  FOR UPDATE TO authenticated
  USING (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY weekly_featured_admin_all ON public.weekly_featured
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles / sutijumi / email_subscribers: tikai nosauktās vaļīgās politikas.
-- Paredzētās "sava rinda / admin" politikas jau ir no 0030.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_insert_all            ON public.profiles;
DROP POLICY IF EXISTS profiles_update_all            ON public.profiles;
DROP POLICY IF EXISTS auth_update                    ON public.sutijumi;
DROP POLICY IF EXISTS email_subscribers_insert_all   ON public.email_subscribers;
DROP POLICY IF EXISTS email_subscribers_delete_own   ON public.email_subscribers;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Kontrole: atlikušās rakstīšanas politikas uz skartajām tabulām
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tablename::text AS tabula, policyname::text AS politika, cmd::text AS komanda,
       roles::text AS lomas, coalesce(qual, '-') AS using_izteiksme, coalesce(with_check, '-') AS check_izteiksme
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('listings', 'weekly_featured', 'profiles', 'sutijumi', 'email_subscribers')
 ORDER BY 1, 3, 2;
