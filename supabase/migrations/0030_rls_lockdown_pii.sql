-- Migration 0030: RLS lockdown — personas dati vairs nav anonīmi lasāmi
-- Date: 2026-09-23
--
-- KONTEKSTS
-- Audita laikā atklājās divas problēmas.
--
-- 1) RAKSTĪŠANA. `anon` loma varēja arī MAINĪT datus tabulās `orders`,
--    `pakomati` un `compartments`. Praktiski tas nozīmē, ka jebkurš varēja
--    atzīmēt neapmaksātu pasūtījumu kā apmaksātu, nomainīt pakomāta PIN kodu
--    vai mainīt pakomātu konfigurāciju. Tas ir integritātes un krapšanas risks,
--    ne tikai datu noplūde.
--
-- 2) LASĪŠANA. `anon` loma varēja nolasīt:
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
--
-- PĀRBAUDĪTS (koda audits), ka šie ceļi turpina strādāt:
--   * /api/orders/[orderNumber] (cart/success lapa) — createServerClient(),
--     t.i. SUPABASE_SECRET_KEY, RLS apiet. Viesa pasūtījums bez konta OK.
--   * dashboard/pasutijumi — .contains("seller_ids", [seller.id]) sakrīt ar
--     orders_seller_select; statusa maiņa sakrīt ar orders_seller_update.
--   * buyer-profile.tsx un reviews-section-db.tsx — pēc buyer_email / buyer_id,
--     abus sedz orders_select_own.
-- IZLABOTS pirms šīs migrācijas: lib/db-listings.ts fetchBestSellers() lasīja
-- visu orders tabulu ar publisko atslēgu. Tagad agregāciju veic serveris
-- (lib/best-sellers-server.ts + /api/best-sellers), atdodot tikai skaitītājus.
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
-- PĀRBAUDĪTS (koda audits): publisks sekotāju skaits netiek rādīts nekur.
-- Visi pārlūka vaicājumi ir lietotāja tvērumā (.eq("user_id", user.id)) —
-- hot-drops/queries.ts, follow-seller-button.tsx, buyer-profile.tsx. Vienīgā
-- vieta, kas lasa citu lietotāju rindas, ir /api/push/notify, un tā lieto
-- SUPABASE_SECRET_KEY, kas RLS apiet. Atsevišķs skats nav vajadzīgs.
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

-- ────────────────────────────────────────────────────────────────────────────
-- PAKOMATI / COMPARTMENTS / FRANCHISE — saraksts ir publisks (pircējam jāredz
-- pakomāti), bet rakstīt drīkst tikai admins.
-- /admin/pakomati raksta no pārlūka ar lietotāja sesiju, tāpēc tam vajag
-- is_super_admin() politikas, nevis service role.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pakomati     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pakomati_public_read     ON public.pakomati;
DROP POLICY IF EXISTS pakomati_anon_all        ON public.pakomati;
DROP POLICY IF EXISTS pakomati_admin_write     ON public.pakomati;
DROP POLICY IF EXISTS compartments_public_read ON public.compartments;
DROP POLICY IF EXISTS compartments_anon_all    ON public.compartments;
DROP POLICY IF EXISTS compartments_admin_write ON public.compartments;

CREATE POLICY pakomati_public_read ON public.pakomati
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY pakomati_admin_write ON public.pakomati
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY compartments_public_read ON public.compartments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY compartments_admin_write ON public.compartments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- franchise_partners un franchise_shares — komercdati, tikai admins.
-- franchise_shares vēl var neeksistēt (migrācija 0004 nav izpildīta), tāpēc
-- iesaiņojam nosacījumā.
ALTER TABLE public.franchise_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS franchise_partners_anon_all  ON public.franchise_partners;
DROP POLICY IF EXISTS franchise_partners_admin_all ON public.franchise_partners;

CREATE POLICY franchise_partners_admin_all ON public.franchise_partners
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'franchise_shares'
  ) THEN
    EXECUTE 'ALTER TABLE public.franchise_shares ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS franchise_shares_admin_all ON public.franchise_shares';
    EXECUTE 'CREATE POLICY franchise_shares_admin_all ON public.franchise_shares
               FOR ALL TO authenticated
               USING (public.is_super_admin())
               WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- PĒC IZPILDES JĀPĀRBAUDA, ka anon vairs nevar ne lasīt, ne rakstīt:
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     -H "apikey: <publishable>" \
--     "https://<ref>.supabase.co/rest/v1/orders?select=id&limit=1"
-- Sagaidāmais: tukšs masivs vai 401/403, nevis dati.
-- ────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
