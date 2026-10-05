# Dienas produkts — automātiska publicēšana

Katru rītu ~9:00 (vasarā) / ~8:00 (ziemā) Vercel Cron izsauc `/api/cron/daily-product`:

1. izvēlas produktu, kas visilgāk nav rādīts (aktīvs, `quantity > 0`, ar īstu foto, apstiprināts tirgotājs; to pašu tirgotāju nerāda divas dienas pēc kārtas);
2. Gemini uzraksta latvisku tekstu — Facebook (svaigi.lv, ar UTM saiti) un Instagram (tirgus.izipizi.lv, ar tēmturiem);
3. saglabā rindu `social_daily_posts` (viena diena = viena rinda, atkārtota izsaukšana nedubulto ierakstus);
4. `DAILY_PRODUCT_MODE=draft` → e-pasts uz `DAILY_PRODUCT_PREVIEW_EMAIL` ar pogu **Publicēt**;
   `DAILY_PRODUCT_MODE=live` → publicē uzreiz: FB foto ieraksts + IG ieraksts + IG Stories.

## Uzstādīšana

1. Palaid migrāciju `supabase/migrations/0033_social_daily_posts.sql`.
2. Meta: IG kontam tirgus.izipizi.lv jābūt **Business/Creator** un piesaistītam FB lapai.
   Meta for Developers lietotnē vajag atļaujas `pages_manage_posts`, `pages_read_engagement`,
   `instagram_basic`, `instagram_content_publish`. Izveido ilgtermiņa Page access token
   (Graph API Explorer → User token → apmaini pret long-lived → `/me/accounts` dod Page token, kas nebeidzas).
3. Uzstādi vides mainīgos (sk. nākamo sadaļu), tad **pārdeploy** — jauni mainīgie stājas spēkā tikai nākamajā deploy.
4. Pārbaudi ar `?dry=1` (sk. „Pārbaude").

## Vides mainīgie

Uzstāda Vercel → projekts `tirgus-izipizi` → **Settings → Environment Variables** (vide **Production**).
Lokāli: `apps/tirgus/.env.local` (parauga fails `apps/tirgus/.env.example`). Slepenas vērtības **nekad** nekomitē.

### Jau ir (citām funkcijām) — atkārtoti nav jāliek

- `CRON_SECRET` — Vercel Cron to nosūta kā `Authorization: Bearer`. **Šeit to lieto arī e-pasta „Publicēt" saites parakstam**, tāpēc, nomainot `CRON_SECRET`, jau nosūtītās saites vairs nederēs.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` — servera klients (`serverSupabase()`). `SUPABASE_SECRET_KEY` ir slepenā atslēga, tikai serverim.
- `NEXT_PUBLIC_SITE_URL` — produkta saitēm; ja nav, lieto `https://tirgus.izipizi.lv`.
- `RESEND_API_KEY`, `EMAIL_FROM` — melnraksta e-pastam. `EMAIL_FROM` neobligāts (noklusējums `tirgus.izipizi.lv <noreply@tirgus.izipizi.lv>`).
- `GEMINI_API_KEY` — to pašu lieto AI asistents.

### Jauni šai funkcijai

- `DAILY_PRODUCT_MODE` — `draft` vai `live`. **Nenorādīt = `draft`** (drošais noklusējums); jebkura cita vērtība arī ir `draft`. Tikai burtiski `live` publicē automātiski bez apstiprinājuma.
- `DAILY_PRODUCT_PREVIEW_EMAIL` — kam sūtīt melnrakstu.
- `META_FB_PAGE_ID`, `META_FB_PAGE_TOKEN` — svaigi.lv Facebook lapas ID un ilgtermiņa Page access token.
- `META_IG_USER_ID` — tirgus.izipizi.lv Instagram Business konta ID.
- `META_IG_ACCESS_TOKEN` — Page token tai FB lapai, kurai piesaistīts IG konts. **Tukšs = lieto `META_FB_PAGE_TOKEN`** (derīgi, ja IG ir piesaistīts tai pašai svaigi.lv lapai).
- `META_GRAPH_VERSION` — neobligāts, noklusējums `v23.0`.

### Kas notiek, ja kāds mainīgais trūkst

- **`DAILY_PRODUCT_PREVIEW_EMAIL` vai `RESEND_API_KEY` nav (draft režīmā)** — melnraksts tiek izveidots `social_daily_posts`, bet e-pasts netiek sūtīts (tikai brīdinājums žurnālā) un pogas nav. Publicēt var tikai ar `?force=1`.
- **Melnraksta e-pasts tiek sūtīts tikai dienas pirmajā izsaukumā.** Ja tas neaizgāja (nepareizs e-pasts, Resend kļūda), atkārtots izsaukums to **nesūta vēlreiz**. Dienas ierakstu var publicēt ar `?force=1` (tas publicē uzreiz, nevis pārsūta e-pastu); kļūdu meklē Vercel žurnālā (`[daily-product] Resend`).
- **`GEMINI_API_KEY` nav** — tiek lietots fiksēts teksts bez AI.
- **`META_*` nav** — nekas netiek publicēts; ieraksts iegūst statusu `failed` ar kļūdu `social_daily_posts.error`. Ja kāds kanāls izdevies, bet cits ne, statuss ir `partial` un nākamais izsaukums mēģina tikai neizdevušos kanālu.
- **`CRON_SECRET` nav** — gan cron, gan publicēšanas saite atbild 401/403; nekas nenotiek.

### Ieteicamā secība pirmajai ieslēgšanai

1. Izpildi migrāciju `0033` (tabula `social_daily_posts` pašlaik ražošanā neeksistē).
2. Uzstādi `DAILY_PRODUCT_PREVIEW_EMAIL` (un pārliecinies, ka `RESEND_API_KEY` ir). **`DAILY_PRODUCT_MODE` nenorādi.**
3. Pārdeploy, palaid `?dry=1` — pārbaudi izvēlēto produktu un tekstu.
4. Pievieno `META_*`, pārdeploy, palaid `?force=1` **vienreiz**, apskati rezultātu Facebook/Instagram.
5. Tikai tad, kad apmierina, vari uzlikt `DAILY_PRODUCT_MODE=live`.

**Piezīme par attēliem.** Instagram pieņem tikai JPEG ar noteiktu malu attiecību. Kods mēģina izmantot Supabase attēlu transformāciju (apgriešana); ja tā nav pieejama (tā ir maksas plāna funkcija), tiek lietots oriģinālais foto, un Instagram var to noraidīt (`IG: ...` kļūda laukā `error`).

## Pārbaude

```bash
# Tikai priekšskatījums — neko nesaglabā, nepublicē
curl -H "Authorization: Bearer $CRON_SECRET" "https://tirgus.izipizi.lv/api/cron/daily-product?dry=1"

# Publicēt šodienas ierakstu uzreiz (arī draft režīmā)
curl -H "Authorization: Bearer $CRON_SECRET" "https://tirgus.izipizi.lv/api/cron/daily-product?force=1"
```

Kļūdas un publicēto ierakstu ID redzami tabulā `social_daily_posts` (`status`, `error`).
Ja kāds kanāls neizdevās (`partial`), nākamā izsaukšana mēģina tikai to kanālu.
