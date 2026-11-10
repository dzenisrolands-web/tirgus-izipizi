# IziPizi monorepo

Turborepo ar npm workspaces. Visas lietotnes dala vienu Supabase projektu.

## Struktūra

```
apps/
  tirgus/     Marketplace — tirgus.izipizi.lv (ražošanā)
packages/
  db/         Supabase klienti un ģenerētie tipi
  auth/       Lomu palīgfunkcijas
  config/     Koplietotie tsconfig un Tailwind preset
supabase/
  migrations/ DB migrācijas — koplietotas starp visām lietotnēm
```

Plānotās lietotnes (`admin`, `fransize`, `kurjeri`, `bizness`) vēl nav izveidotas.
Skat. konsolidācijas plānu.

## Komandas

```bash
npm install              # instalē visu workspace
npm run dev              # palaiž visas lietotnes
npm run build            # būvē visas lietotnes
npm run typecheck        # tipu pārbaude visur
```

Vienai lietotnei:

```bash
npm run dev --workspace=@izipizi/tirgus
```

## Vides mainīgie

Lietotne sagaida:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_SITE_URL
```

Pilns saraksts: `apps/tirgus/.env.example`.

## Deploy

Katrai lietotnei savs Vercel projekts.

**Svarīgi pēc pārejas uz monorepo:** esošajam tirgus Vercel projektam jāmaina
Root Directory no repo saknes uz `apps/tirgus`. Bez šīs izmaiņas būvējums
neizdosies, jo saknē vairs nav Next.js lietotnes.

Settings → General → Root Directory → `apps/tirgus`

Cron uzdevumi definēti `apps/tirgus/vercel.json`.

## Datubāze

Viens Supabase projekts. Migrācijas `supabase/migrations/`, izpildāmas
secīgi caur Supabase dashboard SQL editor.

## Tirgus pārbaudītas versijas palaišana
Šīs komandas nekad neuzskata trūkstošu piekļuvi vai testa pierādījumus par veiksmīgu palaišanu. Slepenos mainīgos nodrošina piekļuves glabātuve/CI vide; tos neiekļauj komandrindas argumentos vai žurnālos.
1. `npm run release:test` pārbauda palaišanas rīku aizsardzības bez ārējiem pakalpojumiem.
2. `npm run release:migrations` izvada tikai pārskatāmo migrāciju nosaukumus un SHA-256; neveic DB izmaiņas.
3. Pārskatītā staging DB kopijā nodrošina `DATABASE_URL`, `RELEASE_TARGET=staging`, `RELEASE_EXPECTED_DB_HOST`, `RELEASE_EXPECTED_DATABASE` un `RELEASE_APPLY_CONFIRM=APPLY_REVIEWED_TIRGUS_RELEASE`; tad `npm run release:migrations -- --apply`. Nepiemēro visas vēsturiskās migrācijas no jauna. Ja apstiprināta migrācija jau reģistrēta ar citu hash, rīks atsakās to pārrakstīt.
4. `npm run release:preflight` lasa DB shēmu/tiesības, Auth konfigurāciju un sagaidāmos vides mainīgos. Vajadzīgi arī `SUPABASE_ACCESS_TOKEN` un `SUPABASE_PROJECT_REF`; atskaitē nav piekļuves vērtību. Pilnās hostētās RLS/storage politikas jāpārbauda ar reālām buyer/seller/admin sesijām staging vidē, nevis tikai shēmas introspekciju.
5. `npm run release:auth-templates` salīdzina piecus hostētos Auth šablonus. To publicēšanai vajadzīgs arī `RELEASE_EXPECTED_PROJECT_REF` un apstiprinātie mērķa mainīgie; `npm run release:auth-templates -- --apply` maina tikai piecus HTML šablonus, nevis SMTP, OAuth vai Paysera piekļuves.
6. Kontrolētam Paysera testa režīma pirkumam pārbauda maksājuma sākšanu, parakstītu callback, atgriešanos, krājuma patērēšanu un saņemtus e-pastus. Pēc faktiskas ārējas pārbaudes operatora pierādījumu atsauces nodrošina ar `RELEASE_TEST_ORDER_ID`, `RELEASE_PAYMENT_TEST_REFERENCE`, `RELEASE_EMAIL_DELIVERY_REFERENCE`. Preflight papildus pārbauda, ka konkrētais DB pasūtījums ir apmaksāts ar pareizo saņemto summu un patērētu rezervāciju; atsauces ir operatora apliecinājums, nevis automātiska bankas/e-pasta piegādes sertifikācija.
7. Tikai pēc staging pārbaudēm un datu rezerves kopijas tos pašus pārskatītos soļus izpilda ar apstiprinātu produkcijas mērķi un publicē lietotni. GitHub/Vercel priekšskatījuma zaļš statuss pats par sevi neapliecina migrāciju vai hostēto šablonu piemērošanu.

Vēsturiskās finanšu problēmas pārbauda superadministratora finanšu darba rindā. Neizdomā trūkstošas veco pasūtījumu likmes vai juridisko personu un neatzīmē atmaksu par veiktu bez ārējas Paysera/bankas atsauces un maksājuma pārbaudes. Ražotāja kurjera savākšanas maksa ir atsevišķa no pircēja piegādes tarifa.
