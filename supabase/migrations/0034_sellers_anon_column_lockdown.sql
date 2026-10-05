-- Migration 0034: sellers — anonīmie apmeklētāji redz tikai publiskās kolonnas
-- Date: 2026-10-05
--
-- KONTEKSTS
-- Pilnā revīzija (scripts/audit-anon-exposure.mjs) parādīja, ka tabula
-- `sellers` anonīmi lasāma ar VISĀM kolonnām, tostarp:
--   bank_iban, bank_swift, bank_name, legal_name, legal_address,
--   registration_number, vat_number, self_billing_agreed_ip,
--   email, admin_notes, internal_notes, rejected_reason, user_id ...
-- RLS politika uz `sellers` ir "visi var lasīt rindas", un RLS nevar ierobežot
-- KOLONNAS — tāpēc jālieto kolonnu līmeņa GRANT.
--
-- KO ŠĪ MIGRĀCIJA DARA
-- Atņem anon lomai SELECT uz visu tabulu un atdod atpakaļ tikai tās kolonnas,
-- ko publiskās lapas patiešām izvēlas (db-listings.ts, hot-drops/queries.ts,
-- cart-page.tsx). Pārbaudīts kodā: neviens anonīms pieprasījums neizmanto
-- select("*") uz sellers; servera maršruti (rēķini, e-pasti, sitemap) lieto
-- service role un šo ierobežojumu apiet.
--
-- KAS PALIEK ATVĒRTS (apzināti)
-- 1) `courier_pickup_address` — grozs to lasa pārlūkā, lai aprēķinātu piegādes
--    zonu viesiem. Pārvietojams uz servera maršrutu atsevišķā darbā.
-- 2) AUTENTIFICĒTI lietotāji (jebkurš reģistrēts pircējs) joprojām var lasīt
--    citu ražotāju bankas un juridiskos datus tieši caur API, jo ražotāja
--    dashboard, rēķinu un admin lapas tos lasa ar lietotāja sesiju.
--    Šo aizver tikai pārvietojot jutīgās kolonnas atsevišķā tabulā vai
--    servera maršrutos. NAV šīs migrācijas apjomā.
--
-- Idempotenta — droši atkārtot.

REVOKE SELECT ON public.sellers FROM anon;

GRANT SELECT (
  id,
  status,
  name,
  farm_name,
  location,
  description,
  short_desc,
  avatar_url,
  cover_url,
  logo_url,
  youtube_video_url,
  youtube_video_id,
  website,
  facebook,
  instagram,
  tiktok,
  youtube_channel,
  rating,
  review_count,
  verified,
  approved_at,
  created_at,
  updated_at,
  slug,
  quote_text,
  quote_author,
  home_locker_ids,
  facts,
  milestones,
  events,
  delivery_mode,
  courier_pickup_address
) ON public.sellers TO anon;

-- Apzināti NAV piešķirts anon:
--   user_id, email, legal_name, registration_number, is_vat_registered,
--   vat_number, legal_address, bank_name, bank_iban, bank_swift,
--   self_billing_agreed, self_billing_agreed_at,
--   self_billing_agreement_version, self_billing_agreed_ip,
--   rejected_reason, rejected_at, rejected_by, approved_by,
--   admin_notes, internal_notes

NOTIFY pgrst, 'reload schema';
