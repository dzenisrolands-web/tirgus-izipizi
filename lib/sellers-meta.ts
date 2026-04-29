export type SellerMeta = {
  cover: string;
  description: string;
  shortDesc: string;
  quote?: { text: string; author: string };
  website?: string;
  facebook?: string;
  instagram?: string;
  youtubeChannel?: string;
  youtubeVideoId?: string;
  facts: { label: string; value: string }[];
  milestones: string[];
  events?: { title: string; desc: string }[];
  keywords: string[];
};

export const sellersMeta: Record<string, SellerMeta> = {
  s7: {
    cover: "https://business.izipizi.lv/images/marketplace/covers/6027852main-bg-webp.webp",
    description:
      "BUJUMS ir Latvijas mīļotākais saldēto delikatešu ražotājs. Nosaukums \"Bujums\" ir Vidzemes dialekta vārds, kas nozīmē labumu, bagātību un raženumu. Tieši tāda ir mūsu filozofija — no lepna zemnieka rokām uz lepna ēdāja vēderu. Visas sastāvdaļas nāk no dabiski audzētiem, kvalitatīviem avotiem. Produkti tiek ražoti Stūķu saimniecībā Gaujas Nacionālajā parkā — vienā no tīrākajām vietām Latvijā. Stūķu sēta ir nacionālā mantojuma objekts, restaurēts izmantojot autentiskus materiālus: koku, akmeni, kaļķi, darvu, kaltu metālu un linu. Saimniecības arhitektūra 2021. gadā saņēma Latvijas Arhitektūras balvu.",
    shortDesc:
      "Bujums — dabīgi pelmeņi, pankūkas un burgerkotletes no Vidzemes. Ražoti Stūķu saimniecībā Gaujas Nacionālajā parkā. Bez mākslīgām piedevām.",
    quote: {
      text: "No lepna zemnieka rokām uz lepna ēdāja vēderu.",
      author: "Bujums",
    },
    website: "https://bujums.lv",
    facebook: "https://www.facebook.com/Bujums",
    instagram: "https://www.instagram.com/bujums.lv",
    youtubeVideoId: "0SMXjZUZxcI",
    facts: [
      { label: "Ražotne", value: "Stūķu saimniecība, Gaujas NP" },
      { label: "Produktu veidi", value: "Vegāni, veģetāri, ar gaļu" },
      { label: "Pieejamība", value: "Latvija, Lietuva, Igaunija" },
      { label: "Reģistrācija", value: "SIA Mammas Dabas Labumi" },
      { label: "Kontakts", value: "+371 22021212" },
    ],
    milestones: [
      "Stūķu saimniecība ieguvusi Latvijas Arhitektūras balvu 2021. gadā",
      "Vairāk nekā 15 pelmeņu šķirnes — no vegāniem līdz brieža gaļas",
      "Pieejami veikalos visā Baltijā",
      "Bez mākslīgiem krāsvielām, aromatizatoriem vai konservantiem",
      "Šoka saldēšana saglabā produktu svaigumu un formu",
    ],
    events: [
      { title: "Zemnieku tirgi", desc: "Regulāri piedalās Rīgas un Vidzemes zemnieku tirgos" },
      { title: "Baltijas izstādes", desc: "Pārstāvēti pārtikas izstādēs Latvijā, Lietuvā un Igaunijā" },
    ],
    keywords: [
      "pelmeņi Latvija", "dabīgi pelmeņi", "bujums pelmeņi", "pankūkas",
      "burgerkotletes", "vegāni pelmeņi", "Vidzeme", "Gaujas NP pārtika",
    ],
  },

  s8: {
    cover: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1400&h=600&fit=crop&q=85",
    description:
      "Wild'N'Free dibināts 2019. gadā Melnsils ciemā, Vidzemes novadā. Sākam ar \"tikai dažām meža gaļas receptēm\" un jau 2023. gadā piedāvājām vairāk nekā 40 dažādus meža gaļas produktus — kļūstot par vienu no visstraujāk augošajiem meža gaļas ražotājiem Latvijā. Mēs izmantojam visu, ko varam no medījuma — līdz pēdējam gaļas gabalam. Visi produkti satur tikai premium meža gaļu bez nevajadzīgām piedevām. Receptes veidotas mājinieku stilā — tādas, kādas radījuši un izmēģinājuši paši darbinieki un viņu ģimenes medību un gatavošanas pieredzē. Wild'N'Free ir kā ģimene ar saviem klientiem, kurus vieno aizraušanās ar veselīgu ēdienu.",
    shortDesc:
      "WILD'N'FREE — medījumu gaļas produkti no Latvijas mežiem. 40+ šķirnes: briedis, alnis, mežacūka. Bez liekām piedevām, Melnsils, Vidzemes novads.",
    quote: {
      text: "Mēs izmantojam visu, ko varam no medījuma — līdz pēdējam gaļas gabalam.",
      author: "Wild'N'Free komanda",
    },
    website: "https://wildnfree.lv",
    facebook: "https://www.facebook.com/medijumugala",
    youtubeChannel: "https://www.youtube.com/@WildNFreeMeat",
    youtubeVideoId: "zsgXP7ksz00",
    facts: [
      { label: "Dibināts", value: "2019. gadā" },
      { label: "Atrašanās vieta", value: "Melnsils, Vidzemes novads" },
      { label: "Produktu skaits", value: "40+ šķirnes" },
      { label: "Gaļas veidi", value: "Briedis, alnis, mežacūka, zaķis" },
      { label: "Atbilstība", value: "ES Reg. 852/2004, 853/2004" },
    ],
    milestones: [
      "Dibināts 2019. gadā ar dažām receptēm, 2023. gadā — jau 40+ produkti",
      "Viens no visstraujāk augošajiem meža gaļas ražotājiem Latvijā",
      "Produkti gatavoti pēc ģimenes receptēm bez liekām piedevām",
      "Gaļa iegūta no Latvijas mežiem un apstrādāta pēc ES pārtikas standartiem",
      "Papildus piedāvā glamping pieredzi «Keep the wild and free» Latvijas dabā",
    ],
    events: [
      { title: "Mednieku festivāli", desc: "Regulāri piedalās mednieku un pārtikas festivālos visā Latvijā" },
      { title: "Glamping", desc: "«Keep the wild and free» — nakšņošana Latvijas dabā pie ražotnes" },
    ],
    keywords: [
      "medījumu gaļa", "meža gaļa", "brieža gaļa", "alņa gaļa", "wild n free",
      "mežacūka", "steiki Latvija", "veselīga gaļa", "Vidzeme",
    ],
  },

  s9: {
    cover:
      "https://business.izipizi.lv/images/marketplace/covers/6922674WhatsApp-Image-2025-12-11-at-11-45-35-1-JPG.JPG",
    description:
      "Oranžās Bumbas — svaigi ikri un jūras delikateses, piegādātas tieši pie tevis ar IziPizi pakomātiem. Augstvērtīgi oranžie lašu ikri, melnie ikri, svaiga forele un citas jūras veltes. Katrs sūtījums transportēts temperatūras kontrolē — tā, lai produkts ierodoties pie klienta būtu tikpat svaigs kā tikko iegūts no ūdens. Mēs ticam, ka ikri un jūras delikateses nav tikai bagātajiem — mūsu misija ir padarīt augstvērtīgas jūras veltes pieejamas ikvienam ar piegādi tieši uz tavu tuvāko IziPizi pakomātu.",
    shortDesc:
      "Oranžās Bumbas — svaigi ikri, forele un jūras veltes ar piegādi uz IziPizi pakomātu. Oranžie un melnie ikri, delikateses Rīgā.",
    quote: {
      text: "Ikri un jūras delikateses nav tikai bagātajiem — tās ir pieejamas ikvienam.",
      author: "Oranžās Bumbas",
    },
    facebook: "https://www.facebook.com/people/Oranžās-Bumbas/100022674248845",
    facts: [
      { label: "Atrašanās vieta", value: "Rīga" },
      { label: "Specializācija", value: "Ikri, forele, jūras veltes" },
      { label: "Piegāde", value: "Temperatūras kontrolē +2°C" },
      { label: "Ikru šķirnes", value: "Oranžie lašu, melnie ikri" },
    ],
    milestones: [
      "Platākā ikru izvēle ar piegādi uz pakomātu Latvijā",
      "Katrs sūtījums transportēts temperatūras kontrolē +2°C",
      "Svaiga forele un ekskluzīvas jūras delikateses",
      "Ātra piegāde — no avota līdz pakomātam minimālā laikā",
    ],
    keywords: [
      "ikri Latvija", "oranžie ikri", "melnie ikri", "forele", "jūras veltes",
      "svaigs ikri piegāde", "Oranžās Bumbas", "delikateses Rīga",
    ],
  },

  s12: {
    cover: "https://business.izipizi.lv/images/marketplace/covers/1975302fons-png.png",
    description:
      "Cake Break ir roku darba konditorejas izstrādājumu ražotājs no Suntažiem, Ogres novadā. Mēs specializējamies bezglutēna un bezlaktozes kūkās, tortēs, mafinīs, profitroļos un pankūkās — jo ticam, ka nevienam nevajadzētu atteikties no saldās baudas veselības ierobežojumu dēļ. Katrs izstrādājums veidots ar rokām no naturālām sastāvdaļām. Lepojamies ar savu \"Suntažu Barona\" šokolādes siera torti, \"Odziņas\" ogu torti un \"Medus pļavas\" torte ar medu no Gaujas Nacionālā parka. Flash saldēšana nodrošina, ka produkti ierodoties pie tevis ir tikpat svaigi kā tikko izņemti no cepeškrāsns.",
    shortDesc:
      "Cake Break — roku darba bezglutēna un bezlaktozes kūkas un tortes no Suntažiem. Svaigi, ar mīlestību gatavoti.",
    quote: {
      text: "Nevienam nevajadzētu atteikties no saldās baudas veselības ierobežojumu dēļ.",
      author: "Cake Break",
    },
    website: "https://www.cakebreak.lv",
    facts: [
      { label: "Atrašanās vieta", value: "Suntaži, Ogres novads" },
      { label: "Specializācija", value: "Bezglutēna, bezlaktozes" },
      { label: "Populārākā torte", value: "Suntažu Barons (11€)" },
      { label: "Min. pasūtījums", value: "25 €" },
      { label: "Pagatavošana", value: "Roku darbs, flash saldēšana" },
    ],
    milestones: [
      "Specializācija bezglutēna un bezlaktozes izstrādājumos",
      "\"Suntažu Barons\" — populārākā šokolādes siera torte",
      "\"Medus pļava\" — torte ar medu no Gaujas Nacionālā parka",
      "Flash saldēšana saglabā svaigumu un garšu kā tikko cepta",
      "Piegāde 4 zonās — Rīga, Pierīga un reģionālie centri",
    ],
    events: [
      { title: "Degustācijas", desc: "Regulāras degustāciju dienas Suntažos un Rīgā" },
      { title: "Svētku pasūtījumi", desc: "Personalizētas tortes dzimšanas dienām un kāzām" },
    ],
    keywords: [
      "tortes Latvija", "bezglutēna torte", "bezlaktozes kūka", "roku darba konditorejas",
      "Cake Break Suntaži", "mafini", "profitroļi", "svaiga kūka piegāde",
    ],
  },

  s13: {
    cover:
      "https://business.izipizi.lv/images/marketplace/covers/9342134ChatGPT-Image-2026-g-26-febr-10-10-44-png.png",
    description:
      "K/S \"Ekoloģisks.lv\" ir Latvijas vadošā bioloģisko lauksaimnieku kooperatīvā sabiedrība, reģistrēta ar Nr. 40203287000. Mēs neesam tikai pārdevējs — mēs esam jaunās pieejas lokālai, atbildīgai un ilgtspējīgai pārtikas sistēmai praktisks īstenotājs. Mūsu dalībnieki ir Latvijas biolauksaimnieki, kuri kopā veido spēcīgu bio pārtikas ražotāju grupu. Visi mūsu produkti ir sertificēti bioloģiski — bez sintētiskiem pesticīdiem, bez ĢMO, bez liekām ķīmiskām piedevām. Piegādājam skolām, restorāniem, kafejnīcām un tagad arī tieši uz IziPizi pakomātu — īsā pārtikas ķēdē no lauka tieši uz galdu.",
    shortDesc:
      "Ekoloģisks.lv — sertificēti bio dārzeņi, presētas eļļas un sulas no Latvijas biolauksaimniekiem. Kooperatīvs, īsā pārtikas ķēde.",
    quote: {
      text: "No lauka tieši uz galdu — bez liekas ķīmijas, bez liekā starpnieka.",
      author: "K/S Ekoloģisks.lv",
    },
    website: "https://ekologisks.lv",
    facebook: "https://www.facebook.com/ekologisks.lv",
    facts: [
      { label: "Juridiskā forma", value: "K/S Nr. 40203287000" },
      { label: "Adrese", value: "Ausekļa iela 7a, Sigulda" },
      { label: "Sertifikāts", value: "Sertificēta bioloģiskā ražošana" },
      { label: "Kontakts", value: "+371 29790927" },
      { label: "E-pasts", value: "info@ekologisks.lv" },
    ],
    milestones: [
      "Latvijas vadošais bioloģisko lauksaimnieku kooperatīvs",
      "Sertificēta bioloģiskā ražošana — visas preces ar bio marķējumu",
      "Piegāde skolām, restorāniem un kafejnīcām vairumā",
      "Bioekonomijas asociācijas biedrs",
      "Īsā pārtikas ķēde — no lauka tieši uz patērētāju",
    ],
    events: [
      { title: "Bio tirgi", desc: "Regulāra dalība bioloģiskās pārtikas tirgos un izstādēs Latvijā" },
      { title: "Tava bio bode", desc: "Fizisks veikals ar bio produktiem Siguldā" },
    ],
    keywords: [
      "bio dārzeņi Latvija", "bioloģiskā pārtika", "ekologisks.lv", "presētas eļļas",
      "bio sulas", "kooperatīvs", "Sigulda bio", "sertificēta bio pārtika",
    ],
  },

  s14: {
    cover: "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=1400&h=600&fit=crop&q=85",
    description:
      "austeru bārs BURŽUJS ir dzīvesstila restorāns un austeru bārs Rīgas Berga Bazārā, Dzirnavu ielā 84. Mēs piedāvājam plašāko svaigu austeru izvēli Latvijā — 12 šķirnes no La Famille Boutrais saimniecības Francijā, kā arī Īrijas Clew Bay un Dundrum Bay austriem. Fine, Spéciale un Super Spéciale šķirnes pieejamas gan restorānā, gan piegādei ar IziPizi pakomātiem. Austeru meistars Renārs Purmalis regulāri vada austeru degustācijas un meistarklases. Katru gadu rīkojam Rīgas Austerju Festivālu — vienu no lielākajiem un pieprasītākajiem kulinārijas notikumiem Baltijā, kurā notiek arī Baltijas jūras austerju atvēršanas čempionāts.",
    shortDesc:
      "BURŽUJS — Rīgas austerju bārs un restorāns. 12 šķirnes svaigu austeru no Francijas un Īrijas. Berga Bazārs, Dzirnavu 84.",
    quote: {
      text: "Austeres nav greznība — tās ir prieks, ko var baudīt ikviens.",
      author: "Renārs Purmalis, austeru meistars",
    },
    website: "https://burzujs.lv",
    facebook: "https://www.facebook.com/restoransburzujs",
    instagram: "https://www.instagram.com/burzujs_",
    youtubeVideoId: "hUL6eYnmHWo",
    facts: [
      { label: "Adrese", value: "Dzirnavu 84, Berga Bazārs, Rīga" },
      { label: "Tālrunis", value: "+371 29343355" },
      { label: "Darba laiks", value: "Ot–Pk 12–22, Se 11–23, Sv 11–19" },
      { label: "Austeru šķirnes", value: "12 šķirnes pastāvīgi" },
      { label: "Izcelsme", value: "Francija, Īrija, Portugāle" },
      { label: "Austeru meistars", value: "Renārs Purmalis" },
    ],
    milestones: [
      "Plašākā svaigu austeru izvēle Latvijā — 12 šķirnes pastāvīgi",
      "Austeres no La Famille Boutrais saimniecības Francijā",
      "Ikgadējais Rīgas Austerju Festivāls — viens no lielākajiem Baltijā",
      "Baltijas jūras austerju atvēršanas čempionāts ar dalībniekiem no 6 valstīm",
      "Austeru meistars Renārs Purmalis vada degustācijas un meistarklases",
      "Atvērts kā mazs kafejnīca, izaudzis par Rīgas prestižāko jūras velšu restorānu",
    ],
    events: [
      {
        title: "Rīgas Austerju Festivāls",
        desc: "Ikgadējs festivāls maijā un septembrī — 12 austeru šķirnes, Baltijas čempionāts austerju atvēršanā, jūras velšu ielu ēdiens, dzīvā mūzika un radošās darbnīcas bērniem. Bezmaksas ieeja.",
      },
      {
        title: "Austeru meistarklases",
        desc: "Regulāras meistarklases ar austeru meistaru Renāru Purmaļi — kā izvēlēties, atvērt un baudīt austeres.",
      },
    ],
    keywords: [
      "austeres Rīga", "austerju bārs", "BURŽUJS", "svaigas austeres Latvija",
      "Fine de Claire", "Spéciale austeres", "Berga Bazārs", "austerju festivāls",
      "austeres piegāde", "jūras veltes Rīga",
    ],
  },
};
