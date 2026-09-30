export type Recipe = {
  slug: string;
  title: string;
  shortDesc: string;
  image: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "Viegla" | "Vidēja" | "Sarežģīta";
  category: string;
  linkedProductIds: string[];
  ingredients: { group?: string; items: string[] }[];
  steps: string[];
  tip?: string;
  tags: string[];
};

export const recipes: Recipe[] = [
  {
    slug: "pelmenu-zupa-ar-darzeniem",
    title: "Pelmeņu zupa ar dārzeņiem",
    shortDesc: "Silta, mājīga zupa ar Bujuma vistas pelmeņiem, burkāniem un seleriju — vakariņas pusstundā.",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=900&h=600&fit=crop",
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    difficulty: "Viegla",
    category: "Zupas",
    linkedProductIds: ["l2", "l1", "l3", "l4", "l6", "l7", "l8"],
    ingredients: [
      {
        items: [
          "1 iepakojums Bujuma Vistas gaļas pelmeņu (400g)",
          "1,5 l vistas buljons",
          "2 burkāni",
          "1 selerijas kāts",
          "1 mazs sīpols",
          "2 ķiploka daiviņas",
          "2 ēd.k. rapšu eļļa",
          "Sāls, melnie pipari pēc garšas",
          "Svaigi dilles vai pētersīļi pasniegšanai",
        ],
      },
    ],
    steps: [
      "Burkānus, seleriju un sīpolu sagriez mazos kubiņos. Ķiploku sasmalcina.",
      "Katliņā uzkarsē eļļu vidēji augstā siltumā. Pievieno sīpolu un sautē 3 min, tad pievieno burkānu, seleriju un ķiploku. Sautē vēl 5 minūtes, līdz dārzeņi mīkstina.",
      "Ielej buljonu, uzvāri. Pievieno sāli un piparus pēc garšas.",
      "Buljonā ieber sasaldētos pelmeņus tieši no iepakojuma — atkausēt nav nepieciešams.",
      "Vāri uz vidējas uguns 8–10 minūtes, līdz pelmeņi uzpeld un mīkla kļūst gaiši pelēka — tas nozīmē, ka ir gatavi.",
      "Pasniedz karstus, pārkaišot ar svaigām dillēm vai pētersīļiem.",
    ],
    tip: "Buljonam var pievienot arī nedaudz svaigu tomātu vai tomātu biezeni — iegūsi krāsaināku, bagātāku garšu.",
    tags: ["zupa", "pelmeņi", "ātri", "bērniem"],
  },
  {
    slug: "brieza-pelmeni-ar-biešu-merci",
    title: "Brieža pelmeņi ar biešu krēmā",
    shortDesc: "Eleganti brieža gaļas pelmeņi Bujuma receptē, pasniegti uz sulīga biešu krēma ar riekstiem.",
    image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=900&h=600&fit=crop",
    prepTime: 15,
    cookTime: 15,
    servings: 2,
    difficulty: "Vidēja",
    category: "Galvenie ēdieni",
    linkedProductIds: ["l8", "l6"],
    ingredients: [
      {
        group: "Pelmeņiem",
        items: [
          "1 iepakojums Bujuma Brieža gaļas pelmeņu (400g)",
          "1 ēd.k. sviests",
          "Sāls, lauru lapas",
        ],
      },
      {
        group: "Biešu krēmam",
        items: [
          "3 vārītas bietes (~300g)",
          "100 ml skābais krējums",
          "1 ēd.k. ābolu etiķis",
          "½ tēj.k. ķimenes",
          "Sāls pēc garšas",
        ],
      },
      {
        group: "Pasniegšanai",
        items: [
          "Sauju grauzdētu valriekstu",
          "Svaigu zaļumu (rukola vai mikrozaļumi)",
          "Nedaudz olīveļļas",
        ],
      },
    ],
    steps: [
      "Bietes, skābo krējumu, ābolu etiķi un ķimenes samaisa ar blenderi līdz gludai masai. Piesāļo. Krēmu atliek siltumā.",
      "Lielā katliņā uzvāri sālītu ūdeni ar lauru lapu. Ieber sasaldētos pelmeņus.",
      "Vāri 8–10 minūtes, līdz uzpeld un kļūst gaiši pelēki.",
      "Izgatavotos pelmeņus uzmanīgi izņem ar karoti, ļauj notecēt ūdenim.",
      "Pannā karsē sviestu, apjauc pelmeņus 1–2 minūtes, lai iegūtu gaiši zeltainu virsmu.",
      "Uz šķīvja uzliec biešu krēmu, virspusē izvieto pelmeņus. Pārber riekstus, zaļumus, apslaka ar nedaudz eļļas.",
    ],
    tip: "Biešu krēmu var pagatavot dienu iepriekš — nakti ledusskapī garša kļūst dziļāka un pilnīgāka.",
    tags: ["pelmeņi", "briedis", "elegants", "restorāna stils"],
  },
  {
    slug: "pankuku-torte",
    title: "Pankūku torte ar sieru un spinātiem",
    shortDesc: "Krāšņa kārtainā torte no Bujuma siera-spinātu pankūkām, svaigā krējuma krēma un garšaugiem.",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&h=600&fit=crop",
    prepTime: 20,
    cookTime: 20,
    servings: 4,
    difficulty: "Vidēja",
    category: "Galvenie ēdieni",
    linkedProductIds: ["l9", "l10", "l11", "l12", "l48"],
    ingredients: [
      {
        group: "Pamats",
        items: [
          "2 iepakojumi Bujuma pankūku ar sieru un spinātiem (360g katrs)",
          "200g mascarpone vai biezpiens",
          "100g skābais krējums",
          "1 ķiploka daiviņa (izspiediet)",
          "Sāls, baltie pipari",
        ],
      },
      {
        group: "Dekorēšanai",
        items: [
          "Sauja rukolas vai svaiga spināta",
          "Ķiršu tomāti",
          "Svaigi garšaugi (dilles, baziliks)",
          "Nedaudz olīveļļas",
        ],
      },
    ],
    steps: [
      "Pankūkas sagatavo pēc iepakojuma norādījumiem — atkausē un apcep pannā no abām pusēm.",
      "Mascarpone samaisa ar skābo krējumu, izspiestu ķiploku, sāli un pipariem.",
      "Uz šķīvja vai dēlīša izvieto pirmo pankūku. Uzsmērē kārtu krēma (apm. 2 ēd.k.).",
      "Turpina kārtot — pankūka, krēms, pankūka — kopā 6–8 kārtas.",
      "Pēdējo kārtu krēma izlīdzina. Virspusē izvieto rukolu, tomātus, garšaugus.",
      "Apslaka ar nedaudz olīveļļas, pabeidz ar jūras sāls pārkaišanu.",
      "Pasniedz uzreiz vai atdzesē 30 min ledusskapī — iegūsi kārtaināku struktūru.",
    ],
    tags: ["pankūkas", "torte", "siers", "spināti", "oriģināls"],
  },
  {
    slug: "brieza-burgers",
    title: "Brieža burgeri ar karamelizētiem sīpoliem",
    shortDesc: "Sulīgi meža gaļas burgeri no Bujuma kotletēm — ar karamelizētiem sīpoliem un mājas majonēzi.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&h=600&fit=crop",
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: "Vidēja",
    category: "Galvenie ēdieni",
    linkedProductIds: ["l14", "l13", "l42", "l50", "l24"],
    ingredients: [
      {
        group: "Burgerim",
        items: [
          "4 Bujuma Brieža gaļas burgeru kotletes",
          "4 burgeru maizītes",
          "4 šķēles čedara siera",
          "Rukola vai ledus salāti",
          "2 tomāti, sagriezti",
          "Marinēti gurķīši",
        ],
      },
      {
        group: "Karamelizētiem sīpoliem",
        items: [
          "3 lieli sīpoli, plāni sagriezti",
          "2 ēd.k. sviests",
          "1 ēd.k. balzamiko etiķis",
          "1 tēj.k. cukurs",
          "Sāls pēc garšas",
        ],
      },
      {
        group: "Mērcei",
        items: [
          "4 ēd.k. majonēze",
          "1 ēd.k. Dižonas sinepes",
          "1 tēj.k. medus",
        ],
      },
    ],
    steps: [
      "Sīpolus apcep sviestā uz lēnas uguns 20 min, maisot ik pa laikam. Kad zeltaini, pievieno balzamiko, cukuru un sāli. Sautē vēl 5 min. Atliek siltumā.",
      "Mērci sagatavo — majonēzi samaisa ar sinepēm un medu. Atdzesē.",
      "Grilu vai pannu uzkarsē augstā siltumā. Kotletes cep no katras puses 4–5 min — negriez biežāk, lai nepazaudētu sulas.",
      "Pēdējā minūtē uz katras kotletes uzliec čedara šķēli — ļauj izkust.",
      "Maizītes grauzdē uz pannas vai grila.",
      "Saliek: mērce → salāti → kotlete ar sieru → karamelizēti sīpoli → tomāts → gurķīši → mērce → maizīte.",
    ],
    tip: "Kotletes cep tieši no saldētavas — neatkausē! Tā gaļa paliek sulīga iekšpusē.",
    tags: ["burgers", "briedis", "grils", "BBQ"],
  },
  {
    slug: "liepu-ziedu-tejas-limonāde",
    title: "Liepu ziedu tējas limonāde",
    shortDesc: "Mājīga vasaras limonāde no Ekoloģisks.lv bioloģiskajiem liepu ziediem — silta vai auksta.",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=900&h=600&fit=crop",
    prepTime: 5,
    cookTime: 10,
    servings: 4,
    difficulty: "Viegla",
    category: "Dzērieni",
    linkedProductIds: ["l29", "l30", "l31", "l32", "l33", "l34", "l35", "l36"],
    ingredients: [
      {
        items: [
          "2 tēj.k. Ekoloģisks.lv Liepu ziedi BIO",
          "1 l karsts ūdens (ne verdošs, apm. 85°C)",
          "3 ēd.k. medus vai agave sīrups",
          "Sula no 2 citroniem",
          "Svaiga piparmētra",
          "Ledus pasniegšanai (aukstai variantā)",
        ],
      },
    ],
    steps: [
      "Liepu ziedus ieliek tējkanniņā vai katlā. Aplej ar karstu (ne verdošu) ūdeni.",
      "Uzmauc vāku, ļauj uzliesmot 8–10 minūtes.",
      "Izkās ziedus. Pievieno medu un citrona sulu — samaisā, kamēr medus izšķīst.",
      "Karstai pasniegšanai: uzreiz ielej krūzēs, dekorē ar citroņa šķēlīti.",
      "Aukstai limonādei: ļauj tējai atdzist, tad ielej glāzēs ar ledu. Pievieno svaigas piparmētras lapas.",
    ],
    tip: "Liepu tēja ir tradicionāls latvju līdzeklis pret aukstumu. Karstā variantā tā palīdz mazināt kakla sāpes un veicina mierīgu miegu.",
    tags: ["tēja", "limonāde", "bio", "vasara", "dzēriens"],
  },
  {
    slug: "veganie-pelmeni-ar-tomatu-merci",
    title: "Vegānie pelmeņi ar tomātu-ķiploku mērci",
    shortDesc: "Bujuma vegānie pelmeņi burkāna-baklažāna pildījumā, pasniegti ar ātro tomātu mērci un baziliku.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&h=600&fit=crop",
    prepTime: 10,
    cookTime: 15,
    servings: 3,
    difficulty: "Viegla",
    category: "Galvenie ēdieni",
    linkedProductIds: ["l1", "l3"],
    ingredients: [
      {
        group: "Pelmeņiem",
        items: [
          "1 iepakojums Bujuma vegāno pelmeņu (400g)",
          "Sāls, lauru lapa",
        ],
      },
      {
        group: "Tomātu mērcei",
        items: [
          "400g sasmalcināti tomāti (kārba)",
          "3 ķiploka daiviņas",
          "2 ēd.k. olīveļļa",
          "1 tēj.k. cukurs",
          "½ tēj.k. kaltēts oregano",
          "Sāls, pipari",
          "Svaigs baziliks pasniegšanai",
        ],
      },
    ],
    steps: [
      "Mērcei — pannā uzkarsē olīveļļu, pievieno sasmalcinātu ķiploku. Sautē 1 min uz vidējas uguns.",
      "Pievieno tomātus, oregano, cukuru, sāli. Sautē 10 minūtes uz lēnas uguns, maisot.",
      "Ūdenī ar sāli un lauru lapu vāri pelmeņus 8–10 min, līdz uzpeld.",
      "Pelmeņus izņem ar sietiņu, uzmanīgi ievieto mērcē. Uzmauc vāku, sautē 2 min.",
      "Pasniedz dziļos šķīvjos ar svaigu baziliku un olīveļļas strūklu.",
    ],
    tip: "Šī recepte lieliski der kā ātra vakariņu versija — visu var pagatavot 20 minūtēs, izmantojot krājumā turētu tomātu kārbu.",
    tags: ["vegāns", "pelmeņi", "ātri", "tomātu mērce"],
  },
];
