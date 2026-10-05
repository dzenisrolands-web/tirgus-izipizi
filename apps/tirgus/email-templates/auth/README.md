# Supabase Auth e-pasta šabloni — tirgus.izipizi.lv

5 šabloni autentifikācijas e-pastiem, ko Supabase sūta lietotājiem.
Latviešu valodā ar tirgus.izipizi.lv branding (`#192635` header, `#53F3A4` akcents).

## Faili

| Šablons | Kad sūta | Subject (kopēt Supabase paneļā) |
|---|---|---|
| `confirm-signup.html` | Lietotājs reģistrējas (role-aware: pircējs/ražotājs) | `Apstiprini reģistrāciju — tirgus.izipizi.lv` |
| `magic-link.html` | Lietotājs lūdz magic-link ielogošanos | `Tava ielogošanās saite — tirgus.izipizi.lv` |
| `reset-password.html` | Lietotājs lūdz paroles atjaunošanu | `Paroles atjaunošana — tirgus.izipizi.lv` |
| `change-email.html` | Lietotājs maina e-pastu profilā | `Apstiprini e-pasta maiņu — tirgus.izipizi.lv` |
| `invite-user.html` | Admin uzaicina jaunu lietotāju | `Tu esi uzaicināts uz tirgus.izipizi.lv` |

## Priekšskatījums

Atver jebkuru `.html` failu pārlūkā (dubultklikšķis) — redzēsi e-pasta izskatu pirms iekopēšanas Supabase.

## Iestatīšana Supabase

1. **Supabase Dashboard** → projekts `tirgus-izipizi` → **Authentication** → **Email Templates**
2. Izvēlies šablonu kreisajā joslā (piem. `Confirm signup`)
3. **Subject heading** laukā ievieto subject no tabulas augstāk
4. **Message body** laukā: izdzēs visu un iekopē attiecīgā HTML faila saturu (Ctrl+A, Ctrl+V)
5. Spied **Save**
6. Atkārto pārējiem 4 šabloniem

## SMTP iestatīšana (lai e-pasti iet caur Resend)

Pirms šablonu kopēšanas pārliecinies, ka Supabase sūta caur tavu domēnu:

**Authentication** → **Settings** → ritini līdz **SMTP Settings**:

```
Enable Custom SMTP        ✓
Sender email              noreply@tirgus.izipizi.lv
Sender name               tirgus.izipizi.lv
Host                      smtp.resend.com
Port                      587
Username                  resend
Password                  <Resend API atslēga, sākas ar "re_">
Min interval              60 (sekundes — anti-spam aizsardzība)
```

Spied **Save**. Pēc saglabāšanas Supabase nosūtīs testa e-pastu uz tavu admin adresi.

## Mainīgie

Šabloni izmanto Supabase Go-template sintaksi:

- `{{ .ConfirmationURL }}` — pilna saite ar token (galvenais)
- `{{ .Email }}` — lietotāja pašreizējā e-pasta adrese (tikai change-email)
- `{{ .NewEmail }}` — jaunā e-pasta adrese (tikai change-email)
- `{{ .Data.role }}` — lietotāja loma no signup metadata (`buyer` vai `seller`)

Nemaini sintaksi `{{ .Variable }}` — tā ir Supabase rezervēta.

### Role-aware šabloni

`confirm-signup.html` ir role-aware: izmanto `{{ if eq .Data.role "seller" }}...{{ else }}...{{ end }}`,
lai pircējam un ražotājam parādītu atšķirīgu tekstu un uzdevumu sarakstu pēc apstiprināšanas.
Tas darbojas, jo `/register/pircejs` un `/register/razotajs` formās role tiek nodota signup metadata laukā.

## Pārbaude

Pēc šablonu uzlikšanas:

1. Atver **inkognito logu** un mēģini reģistrēties ar testa e-pastu
2. Pārbaudi inbox — e-pastam jānāk no `noreply@tirgus.izipizi.lv` ar tirgus.izipizi.lv galvu un pogu **Apstiprināt e-pastu**
3. Spied pogu — jānokļūst atpakaļ uz tirgus.izipizi.lv ar aktivizētu kontu

Ja e-pasts nāk no `noreply@mail.app.supabase.io` — SMTP nav saglabāts pareizi, atkārto soli.
