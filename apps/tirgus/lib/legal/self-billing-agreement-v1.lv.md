---
version: "1.0"
effective_date: "2026-04-29"
language: "lv"
---

# Vienošanās par self-billing kārtību

**(Klienta sastādīts rēķins / Pašizrakstītie rēķini)**

Versija 1.0 · Spēkā no 2026-04-29

---

## 1. Puses

**Operators:**
Sabiedrība ar ierobežotu atbildību "Svaigi"
Reģ. Nr.: 40103915568
PVN reģ. Nr.: LV40103915568
Juridiskā adrese: Margrietas iela 7, Rīga, LV-1046, Latvija
E-pasts: tirgus@izipizi.lv
Tālr.: +371 20031552
Banka: AS Citadele banka, IBAN: LV08PARX0017085950001, BIC: PARXLV22
(turpmāk — **Operators**)

**Tirgotājs:**
[Tirgotāja juridiskais nosaukums]
Reģ. Nr.: [tirgotāja reģ. nr.]
PVN reģ. Nr. (ja PVN maksātājs): [LV + 11 cipari]
Juridiskā adrese: [tirgotāja adrese]
Banka: [tirgotāja banka], IBAN: [tirgotāja IBAN]
(turpmāk — **Tirgotājs**)

Operators un Tirgotājs turpmāk tekstā kopā saukti — **Puses**, atsevišķi — **Puse**.

---

## 2. Vienošanās priekšmets

2.1. Šī vienošanās regulē kārtību, kādā Operators sastāda un izsniedz rēķinus Tirgotāja vārdā par precēm, kas pārdotas elektroniskās tirdzniecības platformā **tirgus.izipizi.lv** (turpmāk — **Platforma**).

2.2. Šī kārtība atbilst Padomes 2006-11-28 direktīvas **2006/112/EK** (PVN direktīva) **224. panta** un Latvijas Pievienotās vērtības nodokļa likuma noteikumiem par klienta sastādītiem rēķiniem (*self-billing*).

2.3. Tirgotājs piekrīt, ka rēķinus par viņa pārdotajām precēm sastāda un izsniedz Operators šajā vienošanās norādītajā kārtībā.

---

## 3. Rēķinu izrakstīšanas periods

3.1. Operators sastāda un izsniedz rēķinus **divas reizes mēnesī**:

- **1. periods:** mēneša 1.–15. datums (rēķins ne vēlāk kā nākamā mēneša 5. datumā vai mēneša 17. datumā)
- **2. periods:** mēneša 16. datums līdz mēneša pēdējais kalendārais datums (rēķins ne vēlāk kā nākamā mēneša 5. datumā)

3.2. Rēķins iekļauj visus Platformā **veiksmīgi apmaksātos** pasūtījumus, kuru maksājuma datums (paid_at) ietilpst attiecīgajā periodā.

---

## 4. Rēķina saturs

4.1. Katrs rēķins satur:

- Rēķina numuru formātā **SV-YYYY-NNNN** (sekvenciāls, nemainīgs)
- Rēķina sastādīšanas datumu
- Pārskata perioda sākuma un beigu datumu
- Operatora un Tirgotāja rekvizītus (4. sadaļa)
- Detalizētu pārskatu pa pasūtījumiem ar kolonnām:
  - Pasūtījuma datums
  - Pasūtījuma numurs
  - Produkta nosaukums
  - Daudzums un mērvienība
  - Bruto cena (EUR ar PVN)
  - Komisijas likme (% un EUR)
  - Neto izmaksa Tirgotājam (EUR)
- Kopsumma:
  - Bruto pārdošanas summa
  - Operatora komisijas summa
  - PVN par komisiju (ja Operators ir PVN maksātājs — 21 %)
  - **Neto summa, kas izmaksājama Tirgotājam**
- Norāde: *"Šis rēķins sastādīts klienta self-billing kārtībā saskaņā ar PVN direktīvas 224. pantu un Tirgotāja-Operatora vienošanos no 2026-04-29."*

4.2. Rēķins tiek nosūtīts Tirgotājam:
- E-pastā uz reģistrēto adresi (PDF pielikumā)
- Pieejams arī Tirgotāja personīgajā kontā Platformā sadaļā **Rēķini**

---

## 5. Komisija

5.1. Operatora komisija ir **5 % līdz 20 %** no katra pasūtījuma bruto summas. Komisija sedz:

- Maksājumu apstrādi (Paysera)
- Pakomātu tīklu un piegādes infrastruktūru (sadarbībā ar SIA IziPizi)
- Klientu atbalstu un atgriešanu apstrādi
- Platformas mārketingu un uzturēšanu

5.2. Komisijas likme tiek noteikta **katram produktam atsevišķi**:

- Tirgotājs piedāvā likmi 5–20 % robežās, izveidojot vai rediģējot produktu
- Operators (super-administrators) apstiprina, modificē vai noraida likmi 1–2 darba dienu laikā
- Apstiprinātā likme tiek **piesaistīta produktam** un attiecas uz visiem turpmākajiem pasūtījumiem
- Pasūtījuma izveides brīdī komisijas likme tiek **fiksēta uz pasūtījumu** (snapshot) un nemainās, ja Tirgotājs vēlāk maina likmi citiem nolūkiem

5.3. Operators publicē indikatīvus komisijas lielumus pa kategorijām, lai palīdzētu Tirgotājam pieņemt informētu lēmumu.

---

## 6. PVN apstrāde

6.1. **Ja Tirgotājs ir PVN maksātājs:** rēķinā tiek norādīts Tirgotāja PVN reģ. nr., PVN tiek aprēķināts un atspoguļots saskaņā ar Latvijas PVN likumu.

6.2. **Ja Tirgotājs nav PVN maksātājs:** rēķins tiek izrakstīts bez PVN no Tirgotāja puses. PVN par Operatora komisijas pakalpojumu (21 %) tiek norādīts atsevišķi.

6.3. Tirgotājs apliecina, ka korekti ir norādījis savu PVN statusu reģistrējoties Platformā un nekavējoties paziņos Operatoram, ja statuss mainās.

---

## 7. Akcepta termiņš un iebildumi

7.1. Tirgotājam ir **7 (septiņas) kalendāra dienas** no rēķina saņemšanas brīža iebildumiem par rēķina saturu vai aprēķiniem.

7.2. Iebildumi iesniedzami rakstiski uz e-pastu **birojs@izipizi.lv** ar atsauci uz rēķina numuru un konkrēto strīdīgo pozīciju.

7.3. Ja iebildumi nav iesniegti 7 dienu laikā, rēķins tiek uzskatīts par **klusi pieņemtu**, un Operators veic samaksu saskaņā ar 8. sadaļu.

7.4. Ja iebildumi tiek iesniegti, Puses 5 darba dienu laikā vienojas par koriģējošu rēķinu vai kompensāciju. Strīdīgā summa tiek aizturēta līdz vienošanās panākšanai.

---

## 8. Samaksa Tirgotājam

8.1. Operators veic neto summas pārskaitījumu uz Tirgotāja IBAN kontu **5 (piecu) darba dienu laikā** pēc rēķina klusas pieņemšanas vai iebildumu atrisināšanas.

8.2. Maksājuma uzdevumā Operators norāda atbilstošo rēķina numuru.

8.3. Tirgotājs ir atbildīgs par precīzu IBAN datu uzturēšanu Platformas profilā. Operators nav atbildīgs par maksājumiem uz nepareizu kontu, ja Tirgotājs nav atjauninājis savus datus.

---

## 9. Atgriešanas un atmaksas

9.1. Ja pircējs Latvijas Patērētāju tiesību aizsardzības likuma noteiktajā termiņā veic preces atgriešanu, Operators veic atmaksu pircējam.

9.2. Atgrieztā summa **tiek atskaitīta no Tirgotāja nākamā perioda neto izmaksas** kā atsevišķa rinda nākamajā rēķinā ar atsauci uz oriģinālo pasūtījumu.

9.3. Operators komisiju par atgrieztajām precēm **neatgriež** Tirgotājam (komisija sedz veikto darbu — maksājumu, atgriešanas apstrādi).

---

## 10. Vienošanās termiņš un izbeigšana

10.1. Vienošanās stājas spēkā brīdī, kad Tirgotājs to elektroniski apstiprina (atzīme par piekrišanu Platformas reģistrācijas vai profila aizpildīšanas formā), un ir spēkā nenoteiktu laiku.

10.2. Jebkura Puse var izbeigt šo vienošanos **rakstiski paziņojot otrai Pusei vismaz 30 (trīsdesmit) kalendāra dienas iepriekš** uz reģistrēto e-pasta adresi.

10.3. Pēc izbeigšanas Operators sastāda gala rēķinu par neapmaksātajiem pasūtījumiem un veic samaksu 5 darba dienu laikā.

10.4. Vienošanās izbeigšana neatbrīvo Puses no jau radušamies saistībām (samaksa, PVN, datu glabāšana).

---

## 11. Versiju izmaiņas

11.1. Operators var atjaunināt šīs vienošanās tekstu (jaunu versiju) ar iepriekšēju paziņojumu Tirgotājam **vismaz 14 (četrpadsmit) dienas** pirms jaunās versijas spēkā stāšanās.

11.2. Tirgotājs var atteikties no jaunās versijas, vai nu (a) izbeidzot vienošanos pēc 10.2. punkta, vai (b) skaidri paziņojot par neapstiprināšanu — šādā gadījumā vienošanās paliek spēkā iepriekšējā versijā vai tiek izbeigta pēc Pušu vienošanās.

11.3. Tirgotāja klusums un Platformas turpmāka izmantošana pēc jaunās versijas spēkā stāšanās tiek uzskatīta par akceptu.

---

## 12. Strīdu risināšana un piemērojamie likumi

12.1. Šai vienošanās piemēro **Latvijas Republikas tiesību aktus**.

12.2. Strīdi, kas izriet no šīs vienošanās un ko neizdodas atrisināt sarunu ceļā, tiek izskatīti **Latvijas Republikas tiesās pēc Operatora juridiskās adreses**.

12.3. Pirms tiesas tiesvedības Puses cenšas atrisināt strīdu sarunu ceļā vai ar mediācijas palīdzību.

---

## 13. Akcepts

Tirgotājs apliecina šo vienošanos, atzīmējot piekrišanas kasti Platformas reģistrācijas vai profila aizpildīšanas formā.

Tehniski tiek saglabāts:
- Apstiprināšanas datums un laiks (timestamp)
- Tirgotāja konta lietotāja ID
- Pieprasījuma IP adrese
- Vienošanās versijas numurs (1.0)

Šis elektroniskais akcepts ir juridiski saistošs saskaņā ar Latvijas **Elektronisko dokumentu likumu**.

Tirgotājs var pieprasīt arī papildu apstiprinājumu ar **eParaksts** vai **eParaksts Mobile** uz e-pastu **birojs@izipizi.lv** — Operators nodrošinās dokumentu attālinātai parakstīšanai.

---

*Vienošanās dokuments versijā 1.0, sastādīts 2026-04-29 Rīgā.*
