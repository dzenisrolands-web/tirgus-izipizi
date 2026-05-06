# DNS instrukcija IT speciālistam — Resend e-pasta sūtīšana

**Domēns:** `tirgus.izipizi.lv`
**Pakalpojums:** Resend (transakciju e-pastu sūtīšana)
**DNS pārvaldnieks:** UNRI
**Mērķis:** Verificēt domēnu Resend pakalpojumā, lai e-pasti no `noreply@tirgus.izipizi.lv` netiktu marķēti kā spam.

---

## Soļi pirms ziņas sūtīšanas IT

1. Atver Resend dashboard: https://resend.com/domains
2. Spied **Add Domain** → ieraksti `tirgus.izipizi.lv` → **Add**
3. Resend parādīs 4 DNS ierakstus (SPF, DKIM, MX, DMARC)
4. **Uzņem screenshot** no Resend dashboard ar visiem ierakstiem
5. Izpildi tālāko ziņu IT speciālistam un pievieno screenshot

---

## Ziņas teksts IT speciālistam

> Sveiki!
>
> Lūdzu pievienot domēnam **tirgus.izipizi.lv** šādus DNS ierakstus
> Resend e-pasta sūtīšanas servisa verifikācijai. Bez šiem ierakstiem
> mūsu transakciju e-pasti (pasūtījumu apstiprinājumi, ražotāju paziņojumi)
> nesaņems sūtīšanas atļauju un tiks marķēti kā spam.
>
> Ekrānuzņēmumā no Resend paneļa redzami visi pievienojamie ieraksti.
> Tie sastāv no četriem ierakstiem:
>
> 1. **SPF** (TXT ieraksts) — atļauj Resend serveriem sūtīt no mūsu domēna
> 2. **DKIM** (TXT ieraksts) — kriptogrāfiska paraksts, lai e-pasti būtu autentiski
> 3. **MX** (priority 10) — bounce/feedback apstrāde
> 4. **DMARC** (TXT ieraksts) — politika neautentificētiem e-pastiem
>
> Visi ieraksti pievienojami **apakšdomēnā** — galvenais `tirgus.izipizi.lv`
> A/CNAME paliek nemainīgs, šie ieraksti tikai paplašina e-pasta funkcionalitāti.
>
> Pēc ierakstu pievienošanas, lūdzu, atbildi šajā tiketā — mēs Resend pusē
> palaidīsim verifikāciju (DNS propagācija parasti aizņem 15 min – 4 stundas).
>
> Pateicos!

---

## Tipiskie ieraksti (orientējošs piemērs)

> ⚠️ IT speciālistam **OBLIGĀTI jāizmanto Resend dashboard precīzās vērtības**, nevis šie. Šis ir tikai vizuāls piemērs, kā ieraksti izskatās.

| Tips | Hosts/Name | Value | Priority | TTL |
|---|---|---|---|---|
| TXT | `send.tirgus.izipizi.lv` | `v=spf1 include:amazonses.com ~all` | — | Auto / 3600 |
| TXT | `resend._domainkey.tirgus.izipizi.lv` | `p=MIGfMA0GCSqGSIb3DQEBAQ...` (garš) | — | Auto / 3600 |
| MX | `send.tirgus.izipizi.lv` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | Auto / 3600 |
| TXT | `_dmarc.tirgus.izipizi.lv` | `v=DMARC1; p=none;` | — | Auto / 3600 |

**Svarīgi UNRI panelim:**

- Daži DNS paneļi prasa ievadīt **tikai apakšdomēna prefiksu** (piem. `send`, `resend._domainkey`, `_dmarc`) bez galvenā domēna `.tirgus.izipizi.lv`. Ja tā ir, tad ievadīt tikai prefiksu — UNRI pievienos pārējo automātiski.
- Ja DKIM vērtība pārsniedz 255 simbolus — UNRI panelim jāļauj sadalīt to vairākās rindās ar pēdiņām (parasti tas notiek automātiski).
- DMARC vērtībā `rua=mailto:...` ir neobligāts — ja UNRI prasa pilnu DMARC formātu, var pievienot `rua=mailto:tirgus@izipizi.lv` beigās.

---

## Pēc IT atbildes

1. Atgriezies Resend dashboard → `Domains` → `tirgus.izipizi.lv`
2. Spied **Verify DNS Records**
3. Ja visi 4 ieraksti zaļi ✓ — domēns gatavs sūtīšanai
4. Ja kāds sarkans ✗ — pārbaudi Resend dashboardā konkrēto kļūdu (parasti TTL nav iestājies, vai prefiksā ir kļūda)

---

## Pēc verifikācijas

Verificēts domēns ļauj:

- Sūtīt no `noreply@tirgus.izipizi.lv` caur Resend API (transakciju e-pasti)
- Pārslēgt Supabase Auth uz Resend SMTP (signup, magic-link, password reset)

Tālāk: skat. `email-templates/auth/README.md` — Supabase šablonu iestatīšana.
