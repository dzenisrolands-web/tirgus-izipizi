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
