-- Atritināšana migrācijai 0036.
-- IZMANTOT TIKAI, ja pēc 0036 saplīst likumīga lietotnes funkcija.
--
-- Apzināti NEATGRIEŽ anonīmās rakstīšanas tiesības un NEATVER sellers
-- anonīmiem — tas atkal atvērtu caurumu, ar kuru ikviens var mainīt ražotāju
-- bankas datus. Atritināšana tikai atslābina ierobežojumus REĢISTRĒTIEM
-- lietotājiem, kas ir pietiekami, lai atjaunotu ražotāju un admin darbību.
--
-- 1) Atļaut reģistrētiem lietotājiem darīt visu ar sellers (kā bija pirms 0036,
--    bet ne anonīmiem).
DROP POLICY IF EXISTS sellers_rollback_authenticated_all ON public.sellers;
CREATE POLICY sellers_rollback_authenticated_all ON public.sellers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2) Ja kāda atsevišķa tabula tiešām prasa anonīmu rakstīšanu (nav atrasta),
--    atver TIKAI to, piem.:
--      GRANT INSERT ON public.<tabula> TO anon;
--    un ierobežo ar RLS politiku. NEIZMANTOT blanket GRANT.

NOTIFY pgrst, 'reload schema';

-- Pēc tam, kad cēlonis ir atrasts un izlabots, noņemt rollback politiku:
--   DROP POLICY sellers_rollback_authenticated_all ON public.sellers;
