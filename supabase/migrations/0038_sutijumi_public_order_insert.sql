-- Migration 0038: atjaunot publisko sūtījumu pasūtīšanas formu (TIKAI INSERT)
-- Date: 2026-10-05
--
-- IZPILDĪT TIKAI, JA FORMA TIEK LIETOTA (sk. zemāk).
--
-- KONTEKSTS
-- Statiskā lapa https://izipizi-web.vercel.app/pasutit (izipizi/apps/web/web/
-- pasutit.html) ieraksta pasūtījumu tieši tabulā `sutijumi` ar publisko atslēgu:
--     sb.from("sutijumi").insert(row)
-- Tas bija paredzēts: oriģinālā migrācija (apps/web/sutijumi.sql) deva anon
-- tiesības TIKAI INSERT. Migrācija 0032 (REVOKE ALL uz sutijumi) un 0036
-- (REVOKE INSERT visām tabulām) šo ceļu pārtrauca — kopš tā laika forma saņem
-- HTTP 401 un pasūtījums netiek saglabāts. Tā bija mana kļūda: pārbaudot kodu,
-- es neizskatīju šo vecāko vietni.
--
-- RISINĀJUMS
-- Atjauno TIKAI INSERT, un stingrāk nekā oriģinālā (with check (true)):
-- jauns pasūtījums drīkst būt tikai ar statusu 'new'. Anonīmais nevar ierakstīt
-- 'paid' vai 'confirmed'. Lasīšanas, mainīšanas un dzēšanas tiesību anon
-- joprojām NAV — apmeklētājs savus pasūtījumus nevar nolasīt vai mainīt.
--
-- IZLEMJ PIRMS IZPILDES
-- Vai šī forma tiek lietota? Pārbaudi Supabase Table Editor -> sutijumi ->
-- jaunākais created_at. Ja pēdējie ieraksti ir pirms 30. septembra un forma
-- vairs nav vajadzīga, šo migrāciju NEIZPILDI (mazāk atvērtu durvju).
--
-- Ilgtermiņā pareizāk ir, lai forma sūta datus uz servera maršrutu ar service
-- role, nevis tieši uz datubāzi. Tad anon INSERT nav vajadzīgs nemaz.
--
-- Idempotenta — droši atkārtot.

GRANT INSERT ON public.sutijumi TO anon;

DROP POLICY IF EXISTS sutijumi_public_insert ON public.sutijumi;
CREATE POLICY sutijumi_public_insert ON public.sutijumi
  FOR INSERT TO anon
  WITH CHECK (status = 'new');

NOTIFY pgrst, 'reload schema';

SELECT policyname::text AS politika, cmd::text AS komanda, roles::text AS lomas, coalesce(with_check, '-') AS check_izteiksme
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'sutijumi'
 ORDER BY 2, 1;
