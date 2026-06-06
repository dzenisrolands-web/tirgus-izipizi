# Lomu un ceļu nošķiršana — pircējs / pārdevējs / super admins

## Mērķis
Viens e-pasts vairs nav vienlaikus pircējs + pārdevējs + super admins ar vienu kopīgu skatu.
- **Pircējs un pārdevējs** = lomas uz vienas identitātes ar pārslēdzēju (Pērku / Pārdodu).
- **Super admins** = cieti nošķirts caur `app_metadata` + atsevišķa ieeja (`/admin`).
- "Konts" saite nekad automātiski neved uz super admina paneli.

---

## 0. Esošā sistēma — izpētes rezultāti

### Kā tagad glabā lomas
- **`profiles` tabula** — kolonna `role` (text): `'buyer'` | `'seller'` | `'super_admin'`
- Katram `auth.users` ir tieši viens `profiles` ieraksts ar `profiles.id = auth.users.id`
- Loma tiek uzstādīta `auth/callback/page.tsx` (64–75. rinda) — ja profila nav, izveido ar `buyer` vai `seller`
- Super admin tiesības piešķir caur `/api/admin/team` — vienkārši `profiles.role = 'super_admin'`
- **Nav `app_metadata` lietojuma** — viss ir tikai `profiles.role`

### Kā `sellers` saistīts ar `auth.users`
- `sellers.user_id` (uuid, nullable) → norāda uz `auth.users.id`
- Migrācija `0022_seller_email_link.sql` — triggeris `link_seller_on_signup()` automātiski sasaista pēc e-pasta
- Daudzi legacy pārdevēji importēti no vecās sistēmas ar `user_id IS NULL`
- `sellers.email` — admin to ievada manuāli, triggeris piesaista pie reģistrācijas

### Nav `middleware.ts`
- Projekts **nelieto** `@supabase/ssr` ar middleware
- Autentifikācija ir pilnībā klienta pusē (`lib/supabase.ts` → `createClient` ar anon key)
- Servera pusē admin API routes lieto `SUPABASE_SECRET_KEY` (service role)

### Kur "Konts" saite ved — pašreizējā loģika (`nav.tsx` 56–58)
```
const accountHref = role === "super_admin" ? "/admin"
  : role === "seller" ? "/dashboard"
  : "/profils";
```
- Lasa `profiles.role` klientā ar anon sesiju
- Ja `super_admin` → ved uz `/admin` (tas ir tas, kas jāmaina)
- Ja `seller` → ved uz `/dashboard`
- Ja `buyer` → ved uz `/profils`

### Login plūsma (`login-form.tsx` 39–43)
```
const role = profile?.role ?? "buyer";
if (role === "super_admin") router.push("/admin");
else if (role === "seller") router.push("/dashboard");
else router.push("/");
```
- Arī lasa `profiles.role` un automātiski pāradresē super adminu

### Admin aizsardzība (`admin-shell.tsx` 100–118)
- Klienta pusē lasa `profiles.role` ar anon sesiju
- Ja `!= 'super_admin'` → redirect uz `/`
- **Problēma**: klienta tokens var lasīt `profiles.role`, tāpēc jebkurš autentificēts lietotājs var redzēt, ka profils ir `super_admin`

### Admin API aizsardzība
- Visas `/api/admin/*` routes pārbauda `profiles.role === 'super_admin'` caur service-role klientu
- Pattern: `assertSuperAdmin()` vai `isAdmin()` — Bearer token → `getUser()` → lasīt profilu
- Piemēri: `team/route.ts`, `generate-invoices/route.ts`, `delete-seller/route.ts`

### RLS politiku stils
- `invoices` — `USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()))`
- `invoice_lines` — caur `invoices` sub-select
- **Nav admin bypass RLS** — admin API routes lieto service role klientu, kas apietu RLS automātiski
- Jaunajām RLS politikām jāseko šim pašam stilam

---

## 1. Kas jāmaina — augsta līmeņa plāns

### A. Super admin izolācija (`app_metadata`)
1. **Migrācija**: pievienot `app_metadata.is_super_admin = true` esošajiem super adminiem caur Supabase Auth Admin API
2. **Noņemt** `profiles.role = 'super_admin'` — super admini profilu tabulā ir `buyer` (vai `seller`, ja viņi arī pārdod)
3. **Admin API routes**: pārbaudīt `user.app_metadata.is_super_admin === true` nevis `profiles.role`
4. **Admin shell**: pārbaudīt `app_metadata` no JWT (var lasīt caur `supabase.auth.getUser()`)
5. **`/api/admin/team`**: promote/demote caur `supabase.auth.admin.updateUserById(id, { app_metadata: { is_super_admin: true/false } })` + noņemt `profiles.role = 'super_admin'` upsert

### B. Pircējs + pārdevējs uz vienas identitātes
1. **`profiles.role`** kļūst par `'buyer'` | `'seller'` | `'both'` — vai vienkāršāk: pievienot `boolean` lauku `can_sell` (default `false`), `profiles.role` paliek tikai `buyer` kā noklusējums
2. **Pārslēdzējs** "Pērku / Pārdodu" — nav vai `/dashboard`, UI elements
3. **`sellers` tabula** jau ir saistīta caur `user_id` — ja lietotājam ir sellers ieraksts, viņš var pārdot
4. **Vienkāršākais variants**: pārslēdzēja loģika ir: vai `sellers` tabulā ir ieraksts ar `user_id = auth.uid()` un `status = 'approved'`? Ja jā — rādīt "Pārdodu" pārslēdzēju

### C. Nav navigācijas izmaiņas
1. **"Konts" saite** vienmēr ved uz `/profils` (pircēja profilu)
2. `/profils` satur pārslēdzēju "Pārdodu" → ved uz `/dashboard`
3. Super admins piekļūst `/admin` tikai caur tiešu URL (vai atsevišķu bookmarketu)
4. Login pēc pieslēgšanās vienmēr ved uz `/` (vai `next` parametru) — nekad uz `/admin`

---

## 2. Detalizētas izmaiņas pa failiem

### DB / Migrācija
- Script: set `app_metadata.is_super_admin = true` visiem esošajiem super adminiem
- Script: mainīt `profiles.role` no `'super_admin'` uz `'buyer'` (vai `'seller'` ja viņiem ir sellers ieraksts)
- Nav nepieciešamas jaunas tabulas vai kolonnas

### `components/nav.tsx`
- Noņemt `super_admin` ceļu no `accountHref`
- `accountHref` vienmēr ir `/profils` (vai `/dashboard` ja lietotājam ir sellers ieraksts)
- Pievienot "Pārdodu" pogu ja sellers ieraksts eksistē

### `components/login-form.tsx`
- Noņemt `super_admin` redirect
- Pēc login vienmēr `router.push("/")` (vai `next`)

### `app/auth/callback/page.tsx`
- Noņemt `super_admin` redirect (81. rinda)
- Pēc callback vienmēr redirect uz `/` vai `next`

### `app/admin/admin-shell.tsx`
- Mainīt `profiles.role !== 'super_admin'` pārbaudi uz `user.app_metadata?.is_super_admin !== true`
- Var lasīt no `supabase.auth.getUser()` → `data.user.app_metadata`

### Visas `/api/admin/*` routes
- Mainīt `assertSuperAdmin()` / `isAdmin()` — lasīt `app_metadata.is_super_admin` caur service-role `auth.getUser(token)`
- Fails: `team/route.ts`, `generate-invoices/route.ts`, `delete-seller/route.ts`, `test-email/route.ts`, `feedback/route.ts`, `invite/route.ts`, `impersonate/route.ts`, `link-seller/route.ts`

### `components/buyer-profile.tsx`
- Pievienot "Pārdodu" pārslēdzēja karti (ja lietotājam ir sellers ieraksts)

### `components/seller-signup-form.tsx`
- Pēc reģistrācijas kā pārdevējs, profils paliek `buyer` bet tiek izveidots `sellers` ieraksts ar `user_id`

---

## 3. Drošības principi

1. `app_metadata` var mainīt **tikai** servera pusē ar service role — klienta tokens to nevar mainīt
2. JWT automātiski satur `app_metadata` — var lasīt klientā bet nevar rediģēt
3. Super admina pārbaude API routes: `user.app_metadata?.is_super_admin === true`
4. Klienta lomas (`buyer` / `seller`) dzīvo tikai `profiles` un `sellers` tabulās
5. RLS politikas: jaunās politikas seko esošajam stilam (`auth.uid()` based)

---

## 4. Migrācijas secība

1. Pievienot `app_metadata.is_super_admin = true` esošajiem super adminiem (Supabase Auth Admin API)
2. Atjaunot kodu: admin pārbaude lasa `app_metadata` nevis `profiles.role`
3. Atjaunot navigāciju: "Konts" → `/profils`, noņemt auto-redirect uz `/admin`
4. Pievienot pārslēdzēju "Pērku / Pārdodu" profilā
5. Notīrīt `profiles.role = 'super_admin'` → mainīt uz `'buyer'` vai `'seller'`
6. Deploy + smoke test

---

## 5. Ietekmētie faili (pilns saraksts)

| Kategorija | Fails |
|---|---|
| Navigācija | `components/nav.tsx` |
| Login | `components/login-form.tsx` |
| Auth callback | `app/auth/callback/page.tsx` |
| Admin shell | `app/admin/admin-shell.tsx` |
| Buyer profils | `components/buyer-profile.tsx` |
| Seller signup | `components/seller-signup-form.tsx` |
| Admin API | `app/api/admin/team/route.ts` |
| Admin API | `app/api/admin/generate-invoices/route.ts` |
| Admin API | `app/api/admin/delete-seller/route.ts` |
| Admin API | `app/api/admin/test-email/route.ts` |
| Admin API | `app/api/admin/feedback/route.ts` |
| Admin API | `app/api/admin/invite/route.ts` |
| Admin API | `app/api/admin/impersonate/route.ts` |
| Admin API | `app/api/admin/link-seller/route.ts` |
| Migrācija | Jauns SQL skripts + Auth Admin API skripts |
