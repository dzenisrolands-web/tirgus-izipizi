-- Migration 0030: RLS lockdown — personas dati vairs nav anonīmi lasāmi
-- Date: 2026-09-23
--
-- KONTEKSTS
-- Audita laikā atklājās, ka `anon` loma ar publisko (publishable) atslēgu
-- varēja nolasīt:
--   orders       86 rindas  — buyer_email, buyer_name, buyer_phone,
--                             delivery_address, locker_code (pakomāta PIN),
--                             payment_id, payment_session_id
--   profiles     49 rindas  — email, full_name, phone
--   invitations 437 rindas  — ražotāju kontaktu e-pasti un vārdi
--   email_templates 8 rindas
--   sutijumi      2 rindas
--
-- Publiskā atslēga pēc dizaina atrodas katrā pārlūka bundlē, tātad šie dati
-- bija pieejami jebkuram. Vienīgā aizsardzība ir RLS, un tā šīm tabulām
-- nebija pareizi uzstādīta.
--
-- BRĪDINĀJUMS
-- Šī migrācija maina dzīvas sistēmas piekļuves tiesības. Vispirms izpildi uz
-- DB klona un pārbaudi: pircēja pasūtījumu lapu, ražotāja pasūtījumu rindu,
-- admin paneli un atsauksmju sadaļu. Tikai pēc tam ražošanā.
--
-- Idempotenta — droši atkārtot.

-- ─────────────────────────────────────────────────────────────────────────────
-- Palīgfunkcija: vai pašreizējais lietotājs ir super admins
-- Lasa app_metadata no JWT — klienta tokens to nevar mainīt.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDERS — pircējs redz savus, ražotājs redz sev adresētos, admins visus.
-- Anonīmiem piekļuves nav.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_anon_select    ON public.orders;
DROP POLICY IF EXISTS orders_public_select  ON public.orders;
DROP POLICY IF EXISTS orders_select_all     ON public.orders;
DROP POLICY IF EXISTS orders_select_own     ON public.orders;
DROP POLICY IF EXISTS orders_seller_select  ON public.orders;
DROP POLICY IF EXISTS orders_admin_all      ON public.orders;

-- Pircējs: sasaiste gan pēc buyer_id, gan pēc e-pasta, jo daļa vecāku
-- pasūtījumu izveidoti bez konta (buyer-profile.tsx meklē pēc buyer_email).
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR buyer_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  );

-- Ražotājs: redz pasūtījumus, kuros ir kāds no viņa seller ierakstiem.
CREATE POLICY orders_seller_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    seller_ids && ARRAY(
      SELECT id::text FROM public.sellers WHERE user_id = auth.uid()
    )
  );

-- Ražotājs drīkst mainīt statusu un ievadīt pakomāta kodu saviem pasūtījumiem.
CREATE POLICY orders_seller_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    seller_ids && ARRAY(
      SELECT id::text FROM public.sellers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY orders_admin_all ON public.orders
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- PROFILES — tikai sava rinda un admins.
-- Pārbaudīts: visi klienta puses profiles lasījumi ir .eq("id", user.id), un
-- atsauksmes autora vārds nāk no reviews.buyer_name, nevis no profiles.
-- Tāpēc publisks skats nav vajadzīgs.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_anon_select     ON public.profiles;
DROP POLICY IF EXISTS profiles_public_select   ON public.profiles;
DROP POLICY IF EXISTS profiles_public_display  ON public.profiles;
DROP POLICY IF EXISTS profiles_select_all      ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own      ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all       ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- app/auth/callback/page.tsx veic upsert pēc pirmās pieslēgšanās — bez šīs
-- politikas jauna lietotāja profila izveide neizdotos.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- INVITATIONS — tikai admins. Servera puses maršruti lieto service role un
-- tāpat apiet RLS.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_anon_select   ON public.invitations;
DROP POLICY IF EXISTS invitations_public_select ON public.invitations;
DROP POLICY IF EXISTS invitations_select_all    ON public.invitations;
DROP POLICY IF EXISTS invitations_admin_all     ON public.invitations;

CREATE POLICY invitations_admin_all ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL_TEMPLATES — tikai admins.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_anon_select   ON public.email_templates;
DROP POLICY IF EXISTS email_templates_public_select ON public.email_templates;
DROP POLICY IF EXISTS email_templates_select_all    ON public.email_templates;
DROP POLICY IF EXISTS email_templates_admin_all     ON public.email_templates;

CREATE POLICY email_templates_admin_all ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SUTIJUMI — tikai admins. Piezīme: /api/admin/sutijumi šobrīd lasa ar anon
-- atslēgu, tāpēc pēc šīs migrācijas tas maršruts pārstās darboties, līdz to
-- pārslēdz uz service-role klientu. Sk. TODO(konsolidācija) tajā failā.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sutijumi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sutijumi_anon_select   ON public.sutijumi;
DROP POLICY IF EXISTS sutijumi_public_select ON public.sutijumi;
DROP POLICY IF EXISTS sutijumi_select_all    ON public.sutijumi;
DROP POLICY IF EXISTS sutijumi_admin_all     ON public.sutijumi;

CREATE POLICY sutijumi_admin_all ON public.sutijumi
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- EMAIL_SUBSCRIBERS — 31 jaunumu abonents. Lietotājs redz un var dzēst savu
-- ierakstu; admins visus. Pieteikšanās iet caur /api/subscribe (servera puse).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_subscribers_anon_select ON public.email_subscribers;
DROP POLICY IF EXISTS email_subscribers_select_all  ON public.email_subscribers;
DROP POLICY IF EXISTS email_subscribers_own         ON public.email_subscribers;
DROP POLICY IF EXISTS email_subscribers_admin_all   ON public.email_subscribers;

CREATE POLICY email_subscribers_own ON public.email_subscribers
  FOR ALL TO authenticated
  USING (email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
  WITH CHECK (email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'));

CREATE POLICY email_subscribers_admin_all ON public.email_subscribers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- SELLER_FOLLOWERS — lietotājs pārvalda savus sekojumus.
-- PĀRBAUDĪT: ja kādā vietā tiek rādīts publisks sekotāju SKAITS, tas pēc šīs
-- politikas rādīs tikai paša lietotāja rindas. Tad vajadzīgs atsevišķs skats vai
-- skaitītājs `sellers` tabulā. Sk. lib/hot-drops/queries.ts:169.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.seller_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_followers_anon_select ON public.seller_followers;
DROP POLICY IF EXISTS seller_followers_select_all  ON public.seller_followers;
DROP POLICY IF EXISTS seller_followers_own         ON public.seller_followers;
DROP POLICY IF EXISTS seller_followers_admin_all   ON public.seller_followers;

CREATE POLICY seller_followers_own ON public.seller_followers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY seller_followers_admin_all ON public.seller_followers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

NOTIFY pgrst, 'reload schema';
