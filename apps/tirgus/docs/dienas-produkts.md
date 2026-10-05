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
3. Vercel env: `META_FB_PAGE_ID`, `META_FB_PAGE_TOKEN`, `META_IG_USER_ID`, `META_IG_ACCESS_TOKEN`
   (ja IG piesaistīts citai lapai, nevis svaigi.lv), `DAILY_PRODUCT_MODE`, `DAILY_PRODUCT_PREVIEW_EMAIL`.
   `CRON_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY` jau ir.

## Pārbaude

```bash
# Tikai priekšskatījums — neko nesaglabā, nepublicē
curl -H "Authorization: Bearer $CRON_SECRET" "https://tirgus.izipizi.lv/api/cron/daily-product?dry=1"

# Publicēt šodienas ierakstu uzreiz (arī draft režīmā)
curl -H "Authorization: Bearer $CRON_SECRET" "https://tirgus.izipizi.lv/api/cron/daily-product?force=1"
```

Kļūdas un publicēto ierakstu ID redzami tabulā `social_daily_posts` (`status`, `error`).
Ja kāds kanāls neizdevās (`partial`), nākamā izsaukšana mēģina tikai to kanālu.
