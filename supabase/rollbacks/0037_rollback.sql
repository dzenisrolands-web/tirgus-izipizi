-- Atritināšana migrācijai 0037.
-- IZMANTOT TIKAI, ja pēc 0037 saplīst likumīga ražotāja vai admin funkcija.
--
-- Atslābina ierobežojumus TIKAI REĢISTRĒTIEM lietotājiem (kā bija pirms 0037).
-- Anonīmajiem rakstīšanas tiesības NETIEK atgrieztas — tās ir atceltas ar 0036.
--
-- 1) Atļaut ielogotiem lietotājiem rakstīt (kā bija).
DROP POLICY IF EXISTS listings_rollback_authenticated_all        ON public.listings;
DROP POLICY IF EXISTS weekly_featured_rollback_authenticated_all ON public.weekly_featured;
DROP POLICY IF EXISTS profiles_rollback_authenticated_all        ON public.profiles;
DROP POLICY IF EXISTS sutijumi_rollback_authenticated_update     ON public.sutijumi;

CREATE POLICY listings_rollback_authenticated_all ON public.listings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY weekly_featured_rollback_authenticated_all ON public.weekly_featured
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY profiles_rollback_authenticated_all ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY sutijumi_rollback_authenticated_update ON public.sutijumi
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- 2) Kad cēlonis ir atrasts un izlabots, noņemt rollback politikas:
--    DROP POLICY listings_rollback_authenticated_all        ON public.listings;
--    DROP POLICY weekly_featured_rollback_authenticated_all ON public.weekly_featured;
--    DROP POLICY profiles_rollback_authenticated_all        ON public.profiles;
--    DROP POLICY sutijumi_rollback_authenticated_update     ON public.sutijumi;
