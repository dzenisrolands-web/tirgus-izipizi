import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { operatorInfo, formattedAddress } from "@/lib/operator-info";

export const metadata: Metadata = {
  title: "Privātuma politika",
  description:
    "Kā SIA Svaigi vāc, izmanto un aizsargā tavus personas datus tirgus.izipizi.lv platformā saskaņā ar GDPR.",
};

export default function PrivatumsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Sākums
      </Link>

      <article className="prose prose-sm max-w-none prose-headings:font-extrabold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-strong:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700">
        <p className="text-xs uppercase tracking-widest text-brand-600 font-bold">
          Versija 1.0 · Atjaunināts 2026-04-29
        </p>

        <h1>Privātuma politika</h1>

        <p>
          Šī privātuma politika apraksta, kā <strong>{operatorInfo.legalName}</strong>{" "}
          (turpmāk — &quot;mēs&quot;) vāc, izmanto un aizsargā personas datus, ko nodod
          platformas <strong>tirgus.izipizi.lv</strong> apmeklētāji un lietotāji.
          Politika atbilst Vispārīgās datu aizsardzības regulas (<strong>GDPR</strong>)
          un Latvijas Fizisko personu datu apstrādes likuma prasībām.
        </p>

        <h2>1. Datu pārzinis</h2>
        <p>
          {operatorInfo.legalName}, reģistrācijas numurs {operatorInfo.registrationNumber},
          juridiskā adrese: {formattedAddress()}.
          Kontakti: <strong>{operatorInfo.contact.emailGeneral}</strong>,
          {" "}<strong>{operatorInfo.contact.phone}</strong>.
        </p>

        <h2>2. Kādus datus mēs vācam</h2>
        <p>Atkarībā no tā, kā tu mijiedarbojies ar platformu, mēs apstrādājam:</p>
        <ul>
          <li><strong>Pircēji:</strong> vārds, uzvārds, e-pasts, tālrunis, piegādes adrese, izvēlētais pakomāts, pasūtījumu vēsture, maksājumu informācija (tikai darījuma identifikators — pilna kartes informācija glabājas Paysera sistēmā)</li>
          <li><strong>Tirgotāji:</strong> visa augšminētā plus juridiskais nosaukums, reģistrācijas numurs, PVN reģistrācijas numurs (ja attiecināms), juridiskā adrese, bankas konta numurs (IBAN), self-billing kārtības piekrišana</li>
          <li><strong>Apmeklētāji bez konta:</strong> IP adrese, pārlūka informācija, sīkdatnes (sk. 8. sadaļu)</li>
          <li><strong>Push paziņojumu abonenti:</strong> pārlūka push subscription identifikators (endpoint, p256dh, auth atslēgas)</li>
        </ul>

        <h2>3. Apstrādes mērķi un juridiskais pamats</h2>
        <ul>
          <li><strong>Pasūtījumu izpilde un piegāde</strong> — līguma izpilde (GDPR 6. panta 1. punkta b apakšpunkts)</li>
          <li><strong>Self-billing rēķinu izrakstīšana tirgotājiem</strong> — līguma izpilde un juridisko pienākumu izpilde</li>
          <li><strong>Klientu atbalsts un strīdu risināšana</strong> — leģitīma interese</li>
          <li><strong>Push paziņojumi par pasūtījuma statusu</strong> — līguma izpilde (skaidri saistīts ar pasūtījumu)</li>
          <li><strong>Push paziņojumi par jauniem produktiem (tirgotāja sekošana)</strong> — tava piekrišana, ko vari atsaukt jebkurā brīdī</li>
          <li><strong>Grāmatvedības uzskaite un nodokļu administrēšana</strong> — juridisks pienākums (Latvijas Grāmatvedības likums)</li>
          <li><strong>Krāpšanas atklāšana un tehniskā drošība</strong> — leģitīma interese</li>
        </ul>

        <h2>4. Datu glabāšanas vietas un trešās puses</h2>
        <p>
          Mēs lietojam šādus datu apstrādātājus, ar kuriem ir noslēgti datu apstrādes
          līgumi (DPA), un dati glabājas Eiropas Savienības teritorijā:
        </p>
        <ul>
          <li><strong>Supabase</strong> (ES reģions) — datubāze un autentifikācija</li>
          <li><strong>Vercel</strong> (ES reģions) — vietnes hosting</li>
          <li><strong>Paysera LT, UAB</strong> (Lietuva) — maksājumu apstrāde</li>
          <li><strong>SIA IziPizi</strong> — pakomātu tīkla operators (saņem tikai pakomāta nr. un saņēmēja vārdu/tālruni)</li>
          <li><strong>Web Push API</strong> (Apple, Google, Mozilla) — push paziņojumu piegāde</li>
        </ul>
        <p>
          Mēs <strong>nepārdodam un nedalāmies</strong> ar taviem datiem ar trešajām pusēm
          mārketinga nolūkos.
        </p>

        <h2>5. Glabāšanas termiņi</h2>
        <ul>
          <li><strong>Konta dati (e-pasts, profils):</strong> kamēr eksistē tavs konts</li>
          <li><strong>Pasūtījumu dati un rēķini:</strong> 5 gadi pēc darījuma (Grāmatvedības likuma prasība)</li>
          <li><strong>Mārketinga piekrišana:</strong> kamēr nesi to atsaucis</li>
          <li><strong>Tehniskie logi un IP:</strong> 90 dienas</li>
        </ul>

        <h2>6. Tavas tiesības</h2>
        <p>Saskaņā ar GDPR tev ir tiesības:</p>
        <ul>
          <li>Piekļūt taviem datiem un saņemt to kopiju</li>
          <li>Pieprasīt datu labošanu, ja tie ir neprecīzi</li>
          <li>Pieprasīt datu dzēšanu (&quot;tiesības tikt aizmirstam&quot;), ja tas nav pretrunā ar mūsu juridiskajiem pienākumiem</li>
          <li>Ierobežot apstrādi vai iebilst pret to</li>
          <li>Saņemt savus datus pārnesamā formātā</li>
          <li>Atsaukt savu piekrišanu (mārketinga, push paziņojumu sekošanai u.c.)</li>
          <li>Iesniegt sūdzību <strong>Datu valsts inspekcijā</strong> (<a href="https://www.dvi.gov.lv" target="_blank" rel="noopener">dvi.gov.lv</a>)</li>
        </ul>
        <p>
          Lai izmantotu šīs tiesības, raksti uz <strong>{operatorInfo.contact.emailComplaints}</strong>.
          Mēs atbildēsim 30 dienu laikā.
        </p>

        <h2>7. Datu drošība</h2>
        <p>
          Mēs lietojam šādus pasākumus: HTTPS šifrēšana, paroles glabājas hash formātā
          (Supabase Auth), bankas dati netiek glabāti mūsu serveros (apstrādā Paysera),
          ierobežota piekļuve administratoriem, regulāra dublēšana, ievainojamību
          uzraudzība.
        </p>

        <h2>8. Sīkdatnes</h2>
        <p>Platforma izmanto šādas sīkdatnes:</p>
        <ul>
          <li><strong>Funkcionālās (obligātas):</strong> autentifikācijas sesija, groza saturs, valodas izvēle. Bez tām vietne nedarbojas.</li>
          <li><strong>Push abonements:</strong> tikai ja atļauj pārlūks un tu apstiprini paziņojumus.</li>
          <li><strong>Mēs nelietojam analītikas vai mārketinga sīkdatnes</strong> bez tavas piekrišanas.</li>
        </ul>
        <p>Tu vari pārvaldīt sīkdatnes sava pārlūka iestatījumos.</p>

        <h2>9. Bērnu datu aizsardzība</h2>
        <p>
          Platforma nav paredzēta personām, kas jaunākas par 16 gadiem. Mēs apzināti
          nevācam datus no bērniem. Ja uzzini, ka bērns mums ir nodevis datus, lūdzu
          paziņo, un mēs tos dzēsīsim.
        </p>

        <h2>10. Politikas izmaiņas</h2>
        <p>
          Mēs varam atjaunināt šo politiku. Būtiskas izmaiņas paziņosim e-pastā un
          publicēsim platformā vismaz 14 dienas iepriekš. Turpmāka platformas
          izmantošana pēc izmaiņām nozīmē tavu piekrišanu jaunajai versijai.
        </p>

        <h2>11. Kontakti</h2>
        <p>
          Jautājumiem par šo politiku un datu apstrādi raksti uz{" "}
          <strong>{operatorInfo.contact.emailComplaints}</strong>.
        </p>
      </article>
    </div>
  );
}
