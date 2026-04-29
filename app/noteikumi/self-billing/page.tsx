import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { operatorInfo, formattedAddress } from "@/lib/operator-info";

export const metadata: Metadata = {
  title: "Self-billing vienošanās — tirgus.izipizi.lv",
  description:
    "Vienošanās par klienta sastādītiem rēķiniem (self-billing) starp SIA Svaigi un tirgotājiem.",
  robots: { index: false, follow: false },
};

export default function SelfBillingAgreementPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/onboarding"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> Atpakaļ uz reģistrāciju
      </Link>

      <article className="prose prose-sm max-w-none prose-headings:font-extrabold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-h3:text-base prose-strong:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700">
        <p className="text-xs uppercase tracking-widest text-brand-600 font-bold">
          Versija 1.0 · Spēkā no 2026-04-29
        </p>

        <h1>Vienošanās par self-billing kārtību</h1>
        <p className="text-base italic text-gray-500 -mt-2">
          (Klienta sastādīts rēķins / Pašizrakstītie rēķini)
        </p>

        <h2>1. Puses</h2>

        <h3>Operators</h3>
        <p>
          {operatorInfo.legalName}
          <br />
          Reģ. Nr.: {operatorInfo.registrationNumber}
          <br />
          PVN reģ. Nr.: {operatorInfo.vatNumber}
          <br />
          Juridiskā adrese: {formattedAddress()}
          <br />
          E-pasts: {operatorInfo.contact.emailGeneral}
          <br />
          Tālr.: {operatorInfo.contact.phone}
          <br />
          Banka: {operatorInfo.bank.name}, IBAN:{" "}
          <span className="font-mono">{operatorInfo.bank.iban}</span>, BIC:{" "}
          {operatorInfo.bank.bic}
          <br />
          (turpmāk — <strong>Operators</strong>)
        </p>

        <h3>Tirgotājs</h3>
        <p className="text-gray-500 italic">
          [Tirgotāja juridiskie rekvizīti, ko aizpilda reģistrējoties Platformā]
          <br />
          (turpmāk — <strong>Tirgotājs</strong>)
        </p>

        <p>
          Operators un Tirgotājs turpmāk tekstā kopā saukti — <strong>Puses</strong>,
          atsevišķi — <strong>Puse</strong>.
        </p>

        <h2>2. Vienošanās priekšmets</h2>
        <p>
          2.1. Šī vienošanās regulē kārtību, kādā Operators sastāda un izsniedz rēķinus
          Tirgotāja vārdā par precēm, kas pārdotas elektroniskās tirdzniecības platformā{" "}
          <strong>tirgus.izipizi.lv</strong> (turpmāk — <strong>Platforma</strong>).
        </p>
        <p>
          2.2. Šī kārtība atbilst Padomes 2006-11-28 direktīvas <strong>2006/112/EK</strong>{" "}
          (PVN direktīva) <strong>224. panta</strong> un Latvijas Pievienotās vērtības
          nodokļa likuma noteikumiem par klienta sastādītiem rēķiniem (<em>self-billing</em>
          ).
        </p>
        <p>
          2.3. Tirgotājs piekrīt, ka rēķinus par viņa pārdotajām precēm sastāda un izsniedz
          Operators šajā vienošanās norādītajā kārtībā.
        </p>

        <h2>3. Rēķinu izrakstīšanas periods</h2>
        <p>3.1. Operators sastāda un izsniedz rēķinus <strong>divas reizes mēnesī</strong>:</p>
        <ul>
          <li>
            <strong>1. periods:</strong> mēneša 1.–15. datums (rēķins ne vēlāk kā mēneša
            17. datumā)
          </li>
          <li>
            <strong>2. periods:</strong> mēneša 16. datums līdz mēneša pēdējais kalendārais
            datums (rēķins ne vēlāk kā nākamā mēneša 5. datumā)
          </li>
        </ul>
        <p>
          3.2. Rēķins iekļauj visus Platformā <strong>veiksmīgi apmaksātos</strong>{" "}
          pasūtījumus, kuru maksājuma datums ietilpst attiecīgajā periodā.
        </p>

        <h2>4. Rēķina saturs</h2>
        <p>4.1. Katrs rēķins satur:</p>
        <ul>
          <li>
            Rēķina numuru formātā <strong className="font-mono">SV-YYYY-NNNN</strong>{" "}
            (sekvenciāls, nemainīgs)
          </li>
          <li>Rēķina sastādīšanas datumu</li>
          <li>Pārskata perioda sākuma un beigu datumu</li>
          <li>Operatora un Tirgotāja rekvizītus</li>
          <li>
            Detalizētu pārskatu pa pasūtījumiem ar kolonnām: pasūtījuma datums, numurs,
            produkts, daudzums, bruto cena, komisijas likme, neto izmaksa
          </li>
          <li>
            Kopsumma: bruto pārdošanas summa, komisija, PVN par komisiju (ja Operators ir
            PVN maksātājs — 21 %), <strong>neto summa, kas izmaksājama Tirgotājam</strong>
          </li>
          <li>
            Norāde: <em>"Šis rēķins sastādīts klienta self-billing kārtībā saskaņā ar PVN
            direktīvas 224. pantu un Tirgotāja-Operatora vienošanos."</em>
          </li>
        </ul>
        <p>
          4.2. Rēķins tiek nosūtīts Tirgotājam e-pastā uz reģistrēto adresi (PDF) un
          pieejams arī Tirgotāja personīgajā kontā Platformā sadaļā <strong>Rēķini</strong>.
        </p>

        <h2>5. Komisija</h2>
        <p>
          5.1. Operatora komisija ir <strong>5 % līdz 20 %</strong> no katra pasūtījuma
          bruto summas. Komisija sedz: maksājumu apstrādi (Paysera), pakomātu tīklu un
          piegādes infrastruktūru, klientu atbalstu un atgriešanu apstrādi, platformas
          mārketingu un uzturēšanu.
        </p>
        <p>5.2. Komisijas likme tiek noteikta <strong>katram produktam atsevišķi</strong>:</p>
        <ul>
          <li>Tirgotājs piedāvā likmi 5–20 % robežās, izveidojot vai rediģējot produktu</li>
          <li>
            Operators apstiprina, modificē vai noraida likmi 1–2 darba dienu laikā
          </li>
          <li>
            Apstiprinātā likme tiek <strong>piesaistīta produktam</strong> un attiecas uz
            visiem turpmākajiem pasūtījumiem
          </li>
          <li>
            Pasūtījuma izveides brīdī komisijas likme tiek <strong>fiksēta uz pasūtījumu</strong>{" "}
            (snapshot) un nemainās, ja Tirgotājs vēlāk maina likmi citiem nolūkiem
          </li>
        </ul>
        <p>
          5.3. Operators publicē indikatīvus komisijas lielumus pa kategorijām, lai
          palīdzētu Tirgotājam pieņemt informētu lēmumu.
        </p>

        <h2>6. PVN apstrāde</h2>
        <p>
          6.1. <strong>Ja Tirgotājs ir PVN maksātājs:</strong> rēķinā tiek norādīts
          Tirgotāja PVN reģ. nr., PVN tiek aprēķināts un atspoguļots saskaņā ar Latvijas
          PVN likumu.
        </p>
        <p>
          6.2. <strong>Ja Tirgotājs nav PVN maksātājs:</strong> rēķins tiek izrakstīts bez
          PVN no Tirgotāja puses. PVN par Operatora komisijas pakalpojumu (21 %) tiek
          norādīts atsevišķi.
        </p>
        <p>
          6.3. Tirgotājs apliecina, ka korekti ir norādījis savu PVN statusu, reģistrējoties
          Platformā, un nekavējoties paziņos Operatoram, ja statuss mainās.
        </p>

        <h2>7. Akcepta termiņš un iebildumi</h2>
        <p>
          7.1. Tirgotājam ir <strong>7 (septiņas) kalendāra dienas</strong> no rēķina
          saņemšanas brīža iebildumiem par rēķina saturu vai aprēķiniem.
        </p>
        <p>
          7.2. Iebildumi iesniedzami rakstiski uz e-pastu{" "}
          <strong>{operatorInfo.contact.emailComplaints}</strong> ar atsauci uz rēķina
          numuru un konkrēto strīdīgo pozīciju.
        </p>
        <p>
          7.3. Ja iebildumi nav iesniegti 7 dienu laikā, rēķins tiek uzskatīts par{" "}
          <strong>klusi pieņemtu</strong>, un Operators veic samaksu saskaņā ar 8. sadaļu.
        </p>
        <p>
          7.4. Ja iebildumi tiek iesniegti, Puses 5 darba dienu laikā vienojas par koriģējošu
          rēķinu vai kompensāciju. Strīdīgā summa tiek aizturēta līdz vienošanās panākšanai.
        </p>

        <h2>8. Samaksa Tirgotājam</h2>
        <p>
          8.1. Operators veic neto summas pārskaitījumu uz Tirgotāja IBAN kontu{" "}
          <strong>5 (piecu) darba dienu laikā</strong> pēc rēķina klusas pieņemšanas vai
          iebildumu atrisināšanas.
        </p>
        <p>8.2. Maksājuma uzdevumā Operators norāda atbilstošo rēķina numuru.</p>
        <p>
          8.3. Tirgotājs ir atbildīgs par precīzu IBAN datu uzturēšanu Platformas profilā.
          Operators nav atbildīgs par maksājumiem uz nepareizu kontu, ja Tirgotājs nav
          atjauninājis savus datus.
        </p>

        <h2>9. Atgriešanas un atmaksas</h2>
        <p>
          9.1. Ja pircējs Latvijas Patērētāju tiesību aizsardzības likuma noteiktajā
          termiņā veic preces atgriešanu, Operators veic atmaksu pircējam.
        </p>
        <p>
          9.2. Atgrieztā summa <strong>tiek atskaitīta no Tirgotāja nākamā perioda neto
          izmaksas</strong> kā atsevišķa rinda nākamajā rēķinā ar atsauci uz oriģinālo
          pasūtījumu.
        </p>
        <p>
          9.3. Operators komisiju par atgrieztajām precēm <strong>neatgriež</strong>{" "}
          Tirgotājam (komisija sedz veikto darbu — maksājumu, atgriešanas apstrādi).
        </p>

        <h2>10. Vienošanās termiņš un izbeigšana</h2>
        <p>
          10.1. Vienošanās stājas spēkā brīdī, kad Tirgotājs to elektroniski apstiprina,
          un ir spēkā nenoteiktu laiku.
        </p>
        <p>
          10.2. Jebkura Puse var izbeigt šo vienošanos <strong>rakstiski paziņojot otrai
          Pusei vismaz 30 (trīsdesmit) kalendāra dienas iepriekš</strong> uz reģistrēto
          e-pasta adresi.
        </p>
        <p>
          10.3. Pēc izbeigšanas Operators sastāda gala rēķinu par neapmaksātajiem
          pasūtījumiem un veic samaksu 5 darba dienu laikā.
        </p>
        <p>
          10.4. Vienošanās izbeigšana neatbrīvo Puses no jau radušamies saistībām
          (samaksa, PVN, datu glabāšana).
        </p>

        <h2>11. Versiju izmaiņas</h2>
        <p>
          11.1. Operators var atjaunināt šīs vienošanās tekstu (jaunu versiju) ar
          iepriekšēju paziņojumu Tirgotājam <strong>vismaz 14 (četrpadsmit) dienas</strong>{" "}
          pirms jaunās versijas spēkā stāšanās.
        </p>
        <p>
          11.2. Tirgotājs var atteikties no jaunās versijas, vai nu (a) izbeidzot
          vienošanos pēc 10.2. punkta, vai (b) skaidri paziņojot par neapstiprināšanu.
        </p>
        <p>
          11.3. Tirgotāja klusums un Platformas turpmāka izmantošana pēc jaunās versijas
          spēkā stāšanās tiek uzskatīta par akceptu.
        </p>

        <h2>12. Strīdu risināšana un piemērojamie likumi</h2>
        <p>12.1. Šai vienošanās piemēro <strong>Latvijas Republikas tiesību aktus</strong>.</p>
        <p>
          12.2. Strīdi, kas izriet no šīs vienošanās un ko neizdodas atrisināt sarunu ceļā,
          tiek izskatīti <strong>Latvijas Republikas tiesās pēc Operatora juridiskās
          adreses</strong>.
        </p>
        <p>
          12.3. Pirms tiesas tiesvedības Puses cenšas atrisināt strīdu sarunu ceļā vai ar
          mediācijas palīdzību.
        </p>

        <h2>13. Akcepts</h2>
        <p>
          Tirgotājs apliecina šo vienošanos, atzīmējot piekrišanas kasti Platformas
          reģistrācijas vai profila aizpildīšanas formā.
        </p>
        <p>Tehniski tiek saglabāts:</p>
        <ul>
          <li>Apstiprināšanas datums un laiks (timestamp)</li>
          <li>Tirgotāja konta lietotāja ID</li>
          <li>Pieprasījuma IP adrese</li>
          <li>Vienošanās versijas numurs (1.0)</li>
        </ul>
        <p>
          Šis elektroniskais akcepts ir juridiski saistošs saskaņā ar Latvijas{" "}
          <strong>Elektronisko dokumentu likumu</strong>.
        </p>
        <p>
          Tirgotājs var pieprasīt arī papildu apstiprinājumu ar <strong>eParaksts</strong>{" "}
          vai <strong>eParaksts Mobile</strong> uz e-pastu{" "}
          <strong>{operatorInfo.contact.emailComplaints}</strong> — Operators nodrošinās
          dokumentu attālinātai parakstīšanai.
        </p>

        <p className="mt-12 text-xs text-gray-400 italic">
          Vienošanās dokuments versijā 1.0, sastādīts 2026-04-29 Rīgā.
        </p>
      </article>
    </div>
  );
}
