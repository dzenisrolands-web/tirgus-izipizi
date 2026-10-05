-- Migration 0036: sellers RLS + anon rakstīšanas tiesību atņemšana
-- Date: 2026-10-05
-- STEIDZAMS: aizver tieši izmantojamu caurumu.
--
-- KONTEKSTS (no ražošanas diagnostikas)
-- 1) Uz `sellers` bija politikas, kas ļauj RAKSTĪT IKVIENAM (roles = public):
--      sellers_update_all  UPDATE USING (true)
--      sellers_delete_all  DELETE USING (true)
--      sellers_insert_all  INSERT WITH CHECK (true)
--    Tās bija spēkā gan anonīmiem, gan reģistrētiem lietotājiem.
-- 2) Lomai `anon` bija piešķirtas INSERT/UPDATE/DELETE/TRUNCATE tiesības uz
--    ~15 tabulām (Supabase noklusējums), un `sellers` tās kombinācijā ar (1)
--    nozīmēja: jebkurš apmeklētājs ar publisko atslēgu var mainīt vai dzēst
--    jebkuru ražotāju, tostarp `bank_iban`.
-- 3) `sellers` lasīšanu ļāva ~10 pārklājošas politikas (true / approved /
--    "auth_can_read_sellers"), tāpēc jutīgās kolonnas bija lasāmas visiem
--    reģistrētajiem lietotājiem.
-- 4) Admin politikas pārbaudīja `profiles.role = 'super_admin'`, bet 0023
--    šo lomu likvidēja. Admin lapas darbojās TIKAI tāpēc, ka politikas "true"
--    ļāva visu ikvienam. Superadmins tagad = JWT app_metadata (is_super_admin()).
--
-- KAS PĀRBAUDĪTS KODĀ
--  * Publiskās lapas jau lasa no skata `sellers_public` (0035, PR #7).
--  * Visi pārlūka puses ieraksti uz sellers (onboarding-form.tsx,
--    dashboard-profile-editor.tsx, app/admin/*) notiek ar IELOGOTA lietotāja
--    sesiju un sūta user_id. Reģistrācija sūta status 'pending', profila
--    redaktors 'draft'.
--  * Vienīgais ieraksts, ko dara neielogots apmeklētājs, ir INSERT uz
--    pwa_events (app/api/pwa/event/route.ts). Visi pārējie anon ieraksti
--    ir nevajadzīgi.
--  * app/api/* maršruti lieto service role un RLS/GRANT apiet.
--
-- NAV ŠĪS MIGRĀCIJAS APJOMĀ (sk. beigu piezīmes)
--  * Ražotājs joprojām var pats mainīt savu `status` uz 'approved'.
--  * Citu tabulu permisīvās politikas (listings, reviews u.c.).
--
-- Atritināšana: supabase/rollbacks/0036_rollback.sql
-- Idempotenta — droši atkārtot.

-- ─────────────────────────────────────────────────────────────────────────────
-- A) sellers: dzēst VISAS esošās politikas un izveidot paredzētās
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'sellers'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sellers', r.policyname);
    RAISE NOTICE 'Dzēsta politika % uz sellers', r.policyname;
  END LOOP;
END $$;

-- Ražotājs redz tikai savu rindu.
CREATE POLICY sellers_owner_select ON public.sellers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Ražotājs var izveidot tikai savu rindu un tikai kā melnrakstu/iesniegtu.
-- (Neļauj reģistrēties uzreiz kā 'approved'.)
CREATE POLICY sellers_owner_insert ON public.sellers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('draft', 'pending'));

-- Ražotājs var mainīt tikai savu rindu un nevar nodot to citam.
CREATE POLICY sellers_owner_update ON public.sellers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Superadmins (JWT app_metadata.is_super_admin) — pilna piekļuve.
CREATE POLICY sellers_admin_all ON public.sellers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- DELETE klientam NAV: dzēšana notiek caur /api/account/remove-seller un
-- /api/admin/delete-seller ar service role.

-- ─────────────────────────────────────────────────────────────────────────────
-- B) anon: atņemt visas tiesības uz sellers (publiskā lasīšana iet caur skatu)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON public.sellers FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- C) anon: atņemt rakstīšanas tiesības uz VISĀM public tabulām
-- ─────────────────────────────────────────────────────────────────────────────
-- Neielogots apmeklētājs nekad nerakstī neko, izņemot pwa_events (zemāk).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

-- Vienīgais likumīgais anonīmais ieraksts: PWA instalēšanas notikumu žurnāls.
GRANT INSERT ON public.pwa_events TO anon;

-- Nākamās tabulas lai vairs automātiski nesaņem anon rakstīšanas tiesības.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Kontrole: atlikušās sellers politikas un anon tiesības (redzamas rezultātā)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'policy' AS kind, policyname::text AS name, cmd::text AS detail, roles::text AS roles
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sellers'
UNION ALL
SELECT 'anon grant', table_name::text, string_agg(privilege_type, ',' ORDER BY privilege_type), 'anon'
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee = 'anon'
   AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
 GROUP BY table_name
ORDER BY 1, 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- PIEZĪMES (zināms, neaizvērts šajā migrācijā)
-- 1) `sellers_owner_update` ļauj ražotājam mainīt jebkuru savas rindas kolonnu,
--    arī `status`, `verified`, `admin_notes`. Labojums prasa trigeri vai
--    kolonnu līmeņa UPDATE ierobežojumu; jāpārbauda ar testa kontiem.
-- 2) Citās tabulās, iespējams, ir līdzīgas "..._all USING (true)" politikas
--    (listings, reviews, weekly_featured, promo_codes, user_roles u.c.). Tās
--    pēc šīs migrācijas vairs nav anonīmi izmantojamas, bet reģistrēti
--    lietotāji tās varētu izmantot. Nepieciešama atsevišķa diagnostika.
-- ─────────────────────────────────────────────────────────────────────────────
