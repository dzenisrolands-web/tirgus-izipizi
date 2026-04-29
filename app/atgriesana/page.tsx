import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { operatorInfo } from "@/lib/operator-info";

export const metadata: Metadata = {
  title: "Atgriešanas politika",
  description:
    "Kā atgriezt produktu tirgus.izipizi.lv un saņemt atmaksu — 14 dienu atteikuma tiesības saskaņā ar Latvijas Patērētāju tiesību aizsardzības likumu.",
};

export default function AtgriesanaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Sākums
      </Link>

      <article className="prose prose-sm max-w-none prose-headings:font-extrabold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-strong:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700">
        <p className="text-xs uppercase tracking-widest text-brand-600 font-bold">
          Versija 1.0 · Spēkā no 2026-04-29
        </p>

        <h1>Atgriešanas politika</h1>

        <p>
          Šī politika apraksta, kā tu vari atgriezt produktu un saņemt atmaksu, kā arī
          ko darīt bojātu vai nepareizu produktu gadījumā. Politika atbilst Latvijas
          Patērētāju tiesību aizsardzības likumam.
        </p>

        {/* Quick summary */}
        <div className="not-prose mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <Clock size={18} className="text-green-600" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-green-700">14 dienas</p>
            <p className="mt-1 text-sm text-green-900">Atteikuma tiesības lielākajai produktu daļai</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-amber-700">Izņēmumi</p>
            <p className="mt-1 text-sm text-amber-900">Ātri bojājoša pārtika, individuāli produkti</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <CheckCircle size={18} className="text-blue-600" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-blue-700">14 dienu atmaksa</p>
            <p className="mt-1 text-sm text-blue-900">Pēc produkta saņemšanas atpakaļ</p>
          </div>
        </div>

        <h2>1. 14 dienu atteikuma tiesības</h2>
        <p>
          Saskaņā ar <strong>Patērētāju tiesību aizsardzības likuma 12. pantu</strong>{" "}
          tev ir tiesības 14 kalendāra dienu laikā no produkta saņemšanas brīža atteikties
          no pirkuma <strong>bez iemesla norādīšanas</strong>.
        </p>
        <p>Lai īstenotu šīs tiesības:</p>
        <ul>
          <li>Skaidri paziņo mums par savu lēmumu (e-pasts uz <strong>{operatorInfo.contact.emailComplaints}</strong> ar pasūtījuma numuru)</li>
          <li>Atgriez produktu 14 dienu laikā no paziņojuma</li>
          <li>Produktam jābūt oriģinālajā iepakojumā un nelietotam (vai lietotam minimālā apmērā, lai pārbaudītu kvalitāti)</li>
        </ul>

        <h2>2. Izņēmumi — kuri produkti NAV atgriežami</h2>
        <p>
          Patērētāju tiesību aizsardzības likuma <strong>22. panta 4. daļa</strong>{" "}
          paredz vairākus izņēmumus. Mūsu tirgū tas attiecas uz:
        </p>
        <ul>
          <li><strong>Ātri bojājoša pārtika</strong> — svaiga gaļa, zivis, piena produkti, dārzeņi un augļi, kuru derīguma termiņš ir īss</li>
          <li><strong>Pārtikas produkti, kas pēc piegādes ir izpakoti</strong> un nav atjaunināmi sākotnējā stāvoklī higiēnas apsvērumu dēļ</li>
          <li><strong>Pasūtījumi uz individuālu pieprasījumu</strong> (piem., personalizētas dāvanu kastes)</li>
          <li><strong>Saldēti produkti pēc atkausēšanas</strong></li>
        </ul>
        <p>
          Saldētus, vakuumētus vai konservētus produktus, kas <strong>nav izpakoti</strong>, var atgriezt
          pēc vispārīgajiem 14 dienu noteikumiem.
        </p>

        <h2>3. Kā atgriezt produktu</h2>
        <ol>
          <li><strong>Sazinies ar mums</strong> — sūti e-pastu uz {operatorInfo.contact.emailComplaints} ar pasūtījuma numuru un atgriešanas iemeslu</li>
          <li><strong>Mēs apstiprinām atgriešanu</strong> 1–2 darba dienu laikā un izsniedzam atgriešanas instrukcijas</li>
          <li><strong>Iesaiņo produktu</strong> oriģinālajā iepakojumā, ja iespējams</li>
          <li><strong>Nogādā produktu</strong> uz mūsu norādīto pakomātu vai adresi</li>
          <li><strong>Saņem atmaksu</strong> 14 dienu laikā pēc tam, kad mēs saņemam produktu atpakaļ</li>
        </ol>

        <h2>4. Atgriešanas izmaksas</h2>
        <ul>
          <li>Ja produkts atgriezts <strong>tava lēmuma dēļ (atteikuma tiesības)</strong>: tu sedz atgriešanas piegādes izmaksas</li>
          <li>Ja produkts ir <strong>bojāts vai nepareizs</strong>: mēs sedzam visas izmaksas un nosūtam atpakaļ pakomāta kodu vai kurjeru</li>
        </ul>

        <h2>5. Atmaksa</h2>
        <ul>
          <li>Atmaksa notiek <strong>14 kalendāra dienu laikā</strong> pēc produkta saņemšanas atpakaļ</li>
          <li>Atmaksa tiek veikta uz to pašu maksāšanas līdzekli, kuru izmantoji apmaksai (Paysera)</li>
          <li>Atmaksā ietverta produkta cena un sākotnējā piegādes maksa (ja atgriezts viss pasūtījums)</li>
          <li>Ja atgriezta tikai daļa pasūtījuma, atmaksā tikai konkrētā produkta cenu</li>
        </ul>

        <h2>6. Bojāti vai nepareizi produkti</h2>
        <p>
          Ja saņemtais produkts ir <strong>bojāts, izpakojot to</strong>, kvalitāte
          neatbilst aprakstam vai nosūtīts nepareizs produkts:
        </p>
        <ul>
          <li>Sazinies ar mums <strong>3 dienu laikā</strong> no saņemšanas (lai mēs varam ātri reaģēt)</li>
          <li>Pievieno fotogrāfijas un detalizētu aprakstu</li>
          <li>Mēs izvēlamies kompensācijas veidu kopā ar tevi: <strong>atmaksa</strong>, <strong>aizvietošana</strong> vai <strong>kredīts uz nākamo pirkumu</strong></li>
          <li>Bojātu produktu atgriezt nav obligāti — bieži pietiek ar fotogrāfijām</li>
        </ul>

        <h2>7. Sūdzību iesniegšana</h2>
        <p>
          Ja mūsu atbilde tev neapmierina, tev ir tiesības vērsties:
        </p>
        <ul>
          <li><strong>Patērētāju tiesību aizsardzības centrā (PTAC)</strong>:{" "}
            <a href="https://www.ptac.gov.lv" target="_blank" rel="noopener">ptac.gov.lv</a></li>
          <li><strong>ES strīdu izšķiršanas platformā (ODR)</strong>:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a></li>
        </ul>

        <h2>8. Kontakti atgriešanai</h2>
        <p>
          E-pasts: <strong>{operatorInfo.contact.emailComplaints}</strong>
          <br />
          Tālrunis: <strong>{operatorInfo.contact.phone}</strong> (darba dienās 9:00–18:00)
          <br />
          Pasta adrese: {operatorInfo.legalAddress.street}, {operatorInfo.legalAddress.city},{" "}
          {operatorInfo.legalAddress.postalCode}
        </p>
      </article>
    </div>
  );
}
