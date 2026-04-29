# Paysera setup — tirgus.izipizi.lv

Soli pa solim, kas jākonfigurē Paysera merchant panelī, lai checkout strādā live.

---

## 1. Reģistrēt projektu Paysera

1. Atver: https://bank.paysera.com
2. Pieslēdzies ar SIA Svaigi kontu (vai izveido jaunu, ja vēl nav)
3. Kreisajā izvēlnē: **Projekti un darbības** → **Mani projekti** → **Jauns projekts**
4. Aizpildi:
   - **Projekta nosaukums**: `tirgus.izipizi.lv`
   - **Projekta tips**: `E-veikals` / `Maksājumu pieņemšana`
   - **Mājaslapas URL**: `https://tirgus.izipizi.lv`
   - **Apraksts**: `B2C tirgus pārtikai no Latvijas ražotājiem`
5. Apstiprini un sagaidi verifikāciju (parasti 1 darba diena)

---

## 2. Ņem datus no panelī

Pēc apstiprināšanas projekta lapā redzēsi:

| Lauks | Kur Vercel env mainīgajos |
|-------|---------------------------|
| **Projekta ID** (skaitlis, piem. `123456`) | `PAYSERA_PROJECT_ID` |
| **Paroles** → **Sign password** | `PAYSERA_SIGN_PASSWORD` |

⚠️ **Sign password ir slepena** — neglabā Git, tikai Vercel env mainīgajos.

---

## 3. Konfigurē atgriešanas URL

Projekta iestatījumos sadaļā **Maksājumu apstrāde** vai **Atgriešanas URL**:

| Lauks Paysera | Vērtība |
|---------------|---------|
| **Veiksmīgs maksājums (accept_url)** | `https://tirgus.izipizi.lv/cart/success` |
| **Atcelts (cancel_url)** | `https://tirgus.izipizi.lv/cart/cancel` |
| **Paziņojums (callback_url)** | `https://tirgus.izipizi.lv/api/webhooks/paysera` |

> Mūsu kods sūta `accepturl`, `cancelurl`, `callbackurl` ar konkrēto `?order=…` parametru, tāpēc Paysera panelī vari likt vai nu **bāzes URL**, vai arī **wildcard pattern** (ja Paysera atļauj). Galvenais — domēns sakrīt.

---

## 4. Atļaut IP / domēna whitelisting (ja Paysera prasa)

Daži merchant konti prasa pievienot Vercel IP. Ja Paysera prasa "atļautās IP":
- Vercel webhook nāk no dinamiskām IP — labāk **atstāj tukšu** vai pievieno `0.0.0.0/0`
- Drošību nodrošina **MD5 paraksta verifikācija** (`PAYSERA_SIGN_PASSWORD`), nevis IP filtri.

---

## 5. Vercel env mainīgie

`Project Settings → Environment Variables → Production`:

```
PAYSERA_MODE=live
PAYSERA_PROJECT_ID=123456
PAYSERA_SIGN_PASSWORD=xxx-secret-xxx
NEXT_PUBLIC_SITE_URL=https://tirgus.izipizi.lv
```

Pēc env nomaiņas — **Redeploy** (env nepiestājas runtime, nepieciešams jauns build).

---

## 6. Testēšana

### A. Mock režīms (E2E bez Paysera)
```
PAYSERA_MODE=mock
```
"Apmaksāt" poga aizvedīs uz `/cart/success?mock=1` bez reālas naudas un bez webhook.

### B. Test režīms (Paysera sandbox)
```
PAYSERA_MODE=test
PAYSERA_PROJECT_ID=<test-project>
PAYSERA_SIGN_PASSWORD=<test-password>
```
Paysera atļauj testa karšu numurus; nauda nepārceļas.

### C. Live režīms
```
PAYSERA_MODE=live
```
Pirmais reālais maksājums — iesaku ar 0.50€ pasūtījumu uz savu karti, lai pārliecinātos.

---

## 7. Webhook pārbaude

Pēc maksājuma:

1. Paysera POST'os `/api/webhooks/paysera` ar `data` un `sign`
2. Kods verificē parakstu (MD5 ar `PAYSERA_SIGN_PASSWORD`)
3. Ja `status=1` → `orders.payment_status = 'paid'`, `paid_at = now()`
4. Tiek izsūtīts:
   - 📧 **E-pasts** pircējam (Resend)
   - 🔔 **Push** notifikācija ražotājiem
   - Ja drop pasūtījums — `reserved → sold` Hot Drops tabulā

Pārbauda Vercel **Function Logs** → `api/webhooks/paysera`. Meklē rindas `[paysera] callback ok:`.

Ja redzi `signature mismatch` — ielīmēta nepareiza `PAYSERA_SIGN_PASSWORD`.

Ja redzi `amount mismatch` — kāds mēģinājis manipulēt summu (vai ir bug, kas saglabā `total_cents` kļūdaini).

---

## 8. Refund / atcelšana

Šobrīd **netiek atbalstīti automātiski refundi**. Ja jāatdod nauda:
1. Manuāli Paysera panelī **Maksājumi** → atrast → **Atcelt**
2. Manuāli `orders.payment_status = 'refunded'` Supabase

To-do post-launch: refund API integrācija.
