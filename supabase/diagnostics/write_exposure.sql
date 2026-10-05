-- Diagnostika: kas var RAKSTĪT, un kuras tabulas ir pārāk atvērtas.
-- Tikai lasīšana, neko nemaina. Palaist Supabase SQL redaktorā.
-- Rezultāts ir VIENA šūna: noklikšķini uz tās, Ctrl+C, un ielīmē sarunā.
--
-- Papildina scripts/audit-anon-exposure.mjs, kas nevar pārbaudīt INSERT,
-- jo INSERT tests varētu izveidot īstu rindu.
SELECT string_agg(kind || ' | ' || name || ' | ' || detail, E'\n' ORDER BY kind, name) AS rezultats
FROM (
  -- 1) Kādas rakstīšanas tiesības joprojām ir anon lomai (bez INSERT uz pwa_events, kas ir paredzēts)
  SELECT '1 anon write grant' AS kind, table_name::text AS name,
         string_agg(privilege_type, ',' ORDER BY privilege_type) AS detail
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'anon'
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
   GROUP BY table_name

  UNION ALL
  -- 2) Politikas, kas atļauj rakstīt IKVIENAM (true) — bīstamas arī reģistrētiem lietotājiem
  SELECT '2 permissive write policy', tablename::text || '.' || policyname::text,
         cmd::text || ' / ' || roles::text || ' / using=' || coalesce(qual, '-') || ' / check=' || coalesce(with_check, '-')
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     AND (qual = 'true' OR with_check = 'true')

  UNION ALL
  -- 3) Tabulas ar IZSLĒGTU RLS: tad piekļuvi nosaka tikai GRANT, un authenticated parasti var visu
  SELECT '3 RLS DISABLED', c.relname::text,
         'authenticated: ' || coalesce((
            SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
              FROM information_schema.role_table_grants g
             WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee = 'authenticated'
         ), 'nav')
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity

  UNION ALL
  -- 4) user_roles: ja šeit ir vaļīgas politikas, lietotājs varētu piešķirt sev admina lomu
  SELECT '4 user_roles policy', policyname::text,
         cmd::text || ' / ' || roles::text || ' / using=' || coalesce(qual, '-') || ' / check=' || coalesce(with_check, '-')
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_roles'

  UNION ALL
  -- 5) Politikas uz promo_codes (kuponu kodi — atvērti rakstīšanai nozīmētu bezmaksas piegādi visiem)
  SELECT '5 promo_codes policy', policyname::text,
         cmd::text || ' / ' || roles::text || ' / using=' || coalesce(qual, '-') || ' / check=' || coalesce(with_check, '-')
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'promo_codes'
) t;
