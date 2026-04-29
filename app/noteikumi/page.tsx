import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { operatorInfo, formattedAddress } from "@/lib/operator-info";

export const metadata: Metadata = {
  title: "Lietošanas noteikumi",
  description:
    "Tirgus.izipizi.lv platformas vispārējie lietošanas noteikumi pircējiem un tirgotājiem.",
};

export default function NoteikumiPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Sākums
      </Link>

      <article className="prose prose-sm max-w-none prose-headings:font-extrabold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-strong:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700">
        <p className="text-xs uppercase tracking-widest text-brand-600 font-bold">
          Versija 1.0 · Spēkā no 2026-04-29
        </p>

        <h1>Lietošanas noteikumi</h1>

        <p>
          Šie noteikumi regulē <strong>tirgus.izipizi.lv</strong> platformas (turpmāk —
          Platforma) lietošanu. Lietojot Platformu, tu piekrīti šiem noteikumiem.
        </p>

        <h2>1. Pakalpojuma sniedzējs</h2>
        <p>
          Platformu pārvalda <strong>{operatorInfo.legalName}</strong>, reģ. Nr.{" "}
          {operatorInfo.registrationNumber}, PVN reģ. Nr. {operatorInfo.vatNumber},
          juridiskā adrese: {formattedAddress()}.
          Kontakti: {operatorInfo.contact.emailGeneral}, {operatorInfo.contact.phone}.
        </p>

        <h2>2. Pakalpojuma apraksts</h2>
        <p>
          Platforma ir B2C tirgus vieta, kurā Latvijas pārtikas ražotāji (turpmāk —
          Tirgotāji) piedāvā savus produktus pircējiem. Pasūtījumu izpilde notiek caur
          <strong> izipizi pakomātu tīklu</strong> vai kurjeru piegādi.
        </p>

        <h2>3. Reģistrācija un konts</h2>
        <ul>
          <li>Pirkumus var veikt arī bez konta — kā viesis</li>
          <li>Reģistrēta konta priekšrocības: pasūtījumu vēsture, push paziņojumi, atsauksmju iesniegšana</li>
          <li>Tirgotājiem reģistrācija ir obligāta un tiek apstiprināta manuāli (1–2 darba dienu laikā)</li>
          <li>Esi atbildīgs par sava paroles drošību. Paziņo mums, ja domā, ka kāds nelegitīmi piekļuvis tavam kontam</li>
          <li>Aizliegts izveidot vairākus kontus vai izmantot citu personu datus</li>
        </ul>

        <h2>4. Pasūtīšana un samaksa</h2>
        <ul>
          <li>Pasūtījums tiek noformēts, izvēloties produktus, pakomātu un veicot apmaksu caur Paysera</li>
          <li>Cenas norādītas eiro (€), iekļauj 21% PVN, ja vien nav norādīts citādi</li>
          <li>Piegādes maksa tiek aprēķināta atsevišķi un norādīta pirms apmaksas</li>
          <li>Pasūtījums uzskatāms par noslēgtu pēc veiksmīgas Paysera apmaksas un mūsu apstiprinājuma</li>
          <li>Mums ir tiesības atcelt pasūtījumu, ja produkts nav pieejams (atmaksu veicam 5 darba dienu laikā)</li>
        </ul>

        <h2>5. Piegāde</h2>
        <p>
          Detalizēta informācija par piegādes veidiem, cenām un termiņiem ir{" "}
          <Link href="/piegade">piegādes lapā</Link>. Galvenais:
        </p>
        <ul>
          <li><strong>Pakomāts:</strong> 24/7 pieejams ar temperatūras kontroli (+2°C – +6°C dzesētiem, −18°C saldētiem). Uzglabāšana līdz 48h</li>
          <li><strong>Kurjers:</strong> 4 zonas — Rīga, Pierīga un reģionālie centri (Zonas 0–3), cenas un laika logi piegādes lapā</li>
          <li><strong>Eksprespiegāde:</strong> 2–5 stundas tikai Rīgā un Pierīgā, tikai produktiem ar ⚡ atzīmi</li>
        </ul>

        <h2>6. Atgriešana un sūdzības</h2>
        <p>
          Skat. atsevišķu <Link href="/atgriesana">atgriešanas politiku</Link>. Īsumā:
          14 dienu atteikuma tiesības gandrīz visiem produktiem (izņēmumi: ātri
          bojājoša pārtika, individuāli pasūtīti produkti). Bojātu produktu vai
          sūdzību gadījumā raksti uz <strong>{operatorInfo.contact.emailComplaints}</strong>.
        </p>

        <h2>7. Tirgotāju pienākumi</h2>
        <p>Tirgotāji apņemas:</p>
        <ul>
          <li>Pārdot tikai produktus, kuriem ir tiesības tirgot Latvijā (atbilstība pārtikas drošības un higiēnas prasībām)</li>
          <li>Norādīt precīzu informāciju par produktu (sastāvdaļas, alergēni, derīguma termiņš, uzglabāšanas temperatūra)</li>
          <li>Apstiprināt pasūtījumus 1–2 darba dienu laikā un savlaicīgi nogādāt tos pakomātā</li>
          <li>Aizpildīt juridisko informāciju (juridiskais nosaukums, reģ. nr., PVN status, IBAN)</li>
          <li>Piekrist <Link href="/noteikumi/self-billing">self-billing rēķinu kārtībai</Link></li>
        </ul>

        <h2>8. Aizliegtais saturs un rīcība</h2>
        <p>Lietotājiem aizliegts:</p>
        <ul>
          <li>Pārdot vai iegādāties nelegālus, viltotus vai nedrošus produktus</li>
          <li>Publicēt aizvainojošu, diskriminējošu vai pretlikumīgu saturu (atsauksmes, profila apraksts)</li>
          <li>Mēģināt apiet drošības mehānismus vai iegūt nelegitīmu piekļuvi</li>
          <li>Lietot Platformu mērķiem, kas nav saistīti ar tās paredzēto izmantojumu</li>
        </ul>
        <p>
          Mums ir tiesības bez brīdinājuma slēgt kontu un dzēst saturu, kas pārkāpj
          šos noteikumus.
        </p>

        <h2>9. Atbildības ierobežojums</h2>
        <p>
          Platforma darbojas kā tirgus vieta starp Pircēju un Tirgotāju. Mēs neesam
          produkta pārdevējs (izņemot pašu izrakstīto self-billing rēķinu kontekstu).
          Atbildība par produkta kvalitāti, drošību un sastāvdaļu informāciju gulst uz
          Tirgotāju. Mēs uzņemamies atbildību par Platformas darbību un maksājumu
          drošību.
        </p>

        <h2>10. Intelektuālais īpašums</h2>
        <p>
          Platformas dizains, logo, programmkods un saturs (izņemot tirgotāju
          augšupielādēto saturu) pieder {operatorInfo.legalName}. Aizliegta to
          kopēšana, modificēšana vai izmantošana komerciālos nolūkos bez rakstiskas
          atļaujas.
        </p>

        <h2>11. Personas datu apstrāde</h2>
        <p>
          Personas datu apstrāde ir aprakstīta atsevišķā <Link href="/privatums">privātuma politikā</Link>.
        </p>

        <h2>12. Piemērojamie likumi un strīdu risināšana</h2>
        <p>
          Šiem noteikumiem piemēro Latvijas Republikas tiesību aktus. Strīdi tiek
          risināti sarunu ceļā, neveiksmes gadījumā — Latvijas tiesās pēc{" "}
          {operatorInfo.legalName} juridiskās adreses. Patērētājiem ir tiesības vērsties{" "}
          <a href="https://www.ptac.gov.lv" target="_blank" rel="noopener">Patērētāju tiesību aizsardzības centrā (PTAC)</a> vai
          {" "}<a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">ES strīdu izšķiršanas platformā</a>.
        </p>

        <h2>13. Noteikumu izmaiņas</h2>
        <p>
          Mēs varam atjaunināt šos noteikumus. Būtiskas izmaiņas paziņosim e-pastā
          (reģistrētiem lietotājiem) un publicēsim Platformā vismaz 14 dienas
          iepriekš. Turpmāka Platformas izmantošana nozīmē tavu piekrišanu jaunajai
          versijai.
        </p>

        <h2>14. Kontakti</h2>
        <p>
          Vispārīgi jautājumi: <strong>{operatorInfo.contact.emailGeneral}</strong>
          <br />
          Sūdzības un strīdi: <strong>{operatorInfo.contact.emailComplaints}</strong>
          <br />
          Tālrunis: <strong>{operatorInfo.contact.phone}</strong>
        </p>
      </article>
    </div>
  );
}
