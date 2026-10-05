-- Migration 0035: sellers_public — publisks skats ar tikai nekaitīgajām kolonnām
-- Date: 2026-10-05
--
-- KONTEKSTS
-- 0034 aizvēra `sellers` anonīmiem apmeklētājiem, bet jebkurš REĢISTRĒTS
-- lietotājs joprojām var lasīt citu ražotāju bankas un juridiskos datus,
-- jo `sellers` RLS politika ļauj lasīt visas rindas un RLS nevar ierobežot
-- kolonnas.
--
-- RISINĀJUMS (1. daļa — šī migrācija, droša un papildinoša)
-- Izveido skatu `sellers_public` ar tām pašām kolonnām, ko 0034 atvēra anon
-- lomai. Publiskās lapas pāriet uz šo skatu (lib/db-listings.ts,
-- lib/hot-drops/queries.ts, components/cart-page.tsx). Šī migrācija NEKO
-- neaizvāc un nemaina `sellers` tabulu, tāpēc ražošana nemainās.
--
-- 2. daļa (0036) vēlāk ierobežos `sellers` tabulu uz "sava rinda vai
-- superadmins" — tikai pēc tam, kad koda pāreja uz skatu ir pārbaudīta.
--
-- DROŠĪBA
-- Skats pieder lomai `postgres` un tāpēc izpilda vaicājumu ar īpašnieka
-- tiesībām, apejot `sellers` RLS. Tas ir apzināts: skats atgriež visas rindas,
-- bet tikai izvēlētās kolonnas. (security_invoker ir izslēgts pēc noklusējuma;
-- Supabase to var atzīmēt kā "security definer view".)
-- Jutīgās kolonnas skatā NAV, un nevienu tādu nedrīkst pievienot:
--   user_id, email, legal_name, registration_number, is_vat_registered,
--   vat_number, legal_address, bank_name, bank_iban, bank_swift,
--   self_billing_*, rejected_*, approved_by, admin_notes, internal_notes
--
-- Idempotenta — droši atkārtot.

CREATE OR REPLACE VIEW public.sellers_public AS
SELECT
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
FROM public.sellers;

COMMENT ON VIEW public.sellers_public IS
  'Publiskās ražotāju kolonnas. Apzināti apiet sellers RLS. NEPIEVIENOT jutīgas kolonnas (bankas, juridiskie dati, e-pasts, piezīmes).';

REVOKE ALL ON public.sellers_public FROM PUBLIC;
GRANT SELECT ON public.sellers_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
