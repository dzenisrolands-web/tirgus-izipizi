const IMG = "https://business.izipizi.lv/images/marketplace/products/";
const LOGO = "https://business.izipizi.lv/images/marketplace/logos/";

export type Locker = {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
};

export type Seller = {
  id: string;
  name: string;
  farmName: string;
  avatar: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  location: string;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  sellerId: string;
  seller: Seller;
  lockerId: string;
  locker: Locker;
  freshnessDate: string;
  quantity: number;
  createdAt: string;
};

export const lockers: Locker[] = [
  {
    id: "brivibas",
    name: "Brīvības iela 253",
    address: "Brīvības iela 253 / NESTE",
    city: "Rīga",
    hours: "24/7",
  },
  {
    id: "salaspils",
    name: "Salaspils",
    address: "Zviedru iela 1C / NESTE",
    city: "Salaspils",
    hours: "24/7",
  },
  {
    id: "agenskalna",
    name: "Āgenskalna tirgus",
    address: "Nometņu iela 64 / Tirgus",
    city: "Rīga",
    hours: "24/7",
  },
  {
    id: "tukums",
    name: "Tukuma tirgus",
    address: "J. Raiņa iela 30 / Tirgus",
    city: "Tukums",
    hours: "24/7",
  },
  {
    id: "dundaga",
    name: "Dundagas tirgus",
    address: "Pils 3B / Tirgus",
    city: "Dundaga",
    hours: "24/7",
  },
  {
    id: "ikskile",
    name: "Ikšķile",
    address: "Daugavas iela 63 / Labumu bode",
    city: "Ikšķile",
    hours: "10:00–20:00",
  },
];

export const sellers: Seller[] = [
  {
    id: "s_bujums",
    name: "Bujums",
    farmName: "Bujums — Pelmeņi & Pankūkas",
    avatar: `${LOGO}2424703logo-white-webp.webp`,
    verified: true,
    rating: 4.9,
    reviewCount: 84,
    location: "Rīga",
  },
  {
    id: "s_wildnfree",
    name: "WILD'N'FREE",
    farmName: "WILD'N'FREE — Savvaļas gaļa",
    avatar: `${LOGO}6775821Artboard-1-png.png`,
    verified: true,
    rating: 4.8,
    reviewCount: 61,
    location: "Vidzemes novads",
  },
  {
    id: "s_oranges",
    name: "Oranžās Bumbas",
    farmName: "Oranžās Bumbas — Ikri & Zivis",
    avatar: `${LOGO}8252295WhatsApp-Image-2025-12-15-at-12-56-39-jpeg.jpeg`,
    verified: true,
    rating: 5.0,
    reviewCount: 38,
    location: "Rīga",
  },
  {
    id: "s_cakebreak",
    name: "Cake Break",
    farmName: "Cake Break — Konditorejas izstrādājumi",
    avatar: `${LOGO}2132015Logo-CB-3-png.png`,
    verified: true,
    rating: 4.9,
    reviewCount: 112,
    location: "Suntaži",
  },
  {
    id: "s_ekologisks",
    name: "Ekoloģisks.lv",
    farmName: "K/S Ekoloģisks.lv — Bio dārzeņi",
    avatar: `${LOGO}956832Log-mini-png.png`,
    verified: true,
    rating: 4.7,
    reviewCount: 55,
    location: "Pierīgas novads",
  },
  {
    id: "s_burzujs",
    name: "BURŽUJS",
    farmName: "austeru bārs BURŽUJS",
    avatar: `${LOGO}3294566Burzujs-logo-reverse-jpg.jpg`,
    verified: true,
    rating: 4.9,
    reviewCount: 47,
    location: "Rīga",
  },
];

const [bujums, wildnfree, oranges, cakebreak, ekologisks, burzujs] = sellers;

export const listings: Listing[] = [
  // ── Bujums ──────────────────────────────────────────────────────────────
  {
    id: "l1",
    title: "Pelmeņi vegānie",
    description: "Mājās gatavoti vegānie pelmeņi ar dārzeņu pildījumu. Saldēti, gatavi vārīšanai. 300g.",
    price: 4.00,
    unit: "300g",
    category: "Saldēta pārtika",
    image: `${IMG}4998684Pelmeni-veganie-webp.webp`,
    sellerId: bujums.id,
    seller: bujums,
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-09-01",
    quantity: 20,
    createdAt: "2026-04-20",
  },
  {
    id: "l2",
    title: "Vistas gaļas pelmeņi",
    description: "Sulīgi pelmeņi ar vistas gaļas pildījumu. Bez konservantiem, saldēti. 300g.",
    price: 5.03,
    unit: "300g",
    category: "Saldēta pārtika",
    image: `${IMG}4125043pelmeni-vistas-galas-webp.webp`,
    sellerId: bujums.id,
    seller: bujums,
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-09-01",
    quantity: 15,
    createdAt: "2026-04-21",
  },
  {
    id: "l3",
    title: "Brieža gaļas pelmeņi",
    description: "Izsmalcināti pelmeņi ar savvaļas brieža gaļas pildījumu. Retums! 300g.",
    price: 6.15,
    unit: "300g",
    category: "Saldēta pārtika",
    image: `${IMG}4476674Pelmeni-Brieza-webp.webp`,
    sellerId: bujums.id,
    seller: bujums,
    lockerId: "salaspils",
    locker: lockers[1],
    freshnessDate: "2026-09-01",
    quantity: 10,
    createdAt: "2026-04-22",
  },
  {
    id: "l4",
    title: "Brieža gaļas burgeru kotletes",
    description: "Sulīgas burgerkotletes no tīras brieža gaļas. Saldētas, gatavas cepšanai. 300g.",
    price: 7.93,
    unit: "300g",
    category: "Saldēta pārtika",
    image: `${IMG}233066Burgeri-Brieza-18-webp.webp`,
    sellerId: bujums.id,
    seller: bujums,
    lockerId: "ikskile",
    locker: lockers[5],
    freshnessDate: "2026-09-01",
    quantity: 8,
    createdAt: "2026-04-19",
  },
  // ── WILD'N'FREE ──────────────────────────────────────────────────────────
  {
    id: "l5",
    title: "Brieža steiks stilbs marinēts",
    description: "Savvaļas brieža stilba steiks, marinēts ar garšaugiem. Gatavs grilēšanai vai cepšanai.",
    price: 12.50,
    unit: "gab.",
    category: "Gaļa",
    image: `${IMG}5397193Brie-a-steiks-stilbs-marin-ts-jpg.jpg`,
    sellerId: wildnfree.id,
    seller: wildnfree,
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-05-05",
    quantity: 6,
    createdAt: "2026-04-22",
  },
  {
    id: "l6",
    title: "Brieža gaļas kotletes Mājas",
    description: "Tradicionālas kotletes no tīras savvaļas brieža gaļas. Bez pildvielām un piedevām.",
    price: 8.18,
    unit: "gab.",
    category: "Gaļa",
    image: `${IMG}5421306savvalas-brieza-galas-kotletes-jpg.jpg`,
    sellerId: wildnfree.id,
    seller: wildnfree,
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-05-05",
    quantity: 10,
    createdAt: "2026-04-21",
  },
  {
    id: "l7",
    title: "Brieža steiks Fileja",
    description: "Premium brieža filejas steiks — maigākā un vērtīgākā daļa. Svars ap 250–300g.",
    price: 27.50,
    unit: "gab.",
    category: "Gaļa",
    image: `${IMG}9502131Brie-a-steiks-Fileja-jpg.jpg`,
    sellerId: wildnfree.id,
    seller: wildnfree,
    lockerId: "tukums",
    locker: lockers[3],
    freshnessDate: "2026-05-05",
    quantity: 4,
    createdAt: "2026-04-20",
  },
  // ── Oranžās Bumbas ───────────────────────────────────────────────────────
  {
    id: "l8",
    title: "Oranžie ikri 200g",
    description: "Svaigi oranžie lašu ikri. Delikāts gardums ar spilgtu garšu. Lieliski uz tostes vai sushi.",
    price: 14.00,
    unit: "200g",
    category: "Jūras veltes",
    image: `${IMG}3058WhatsApp-Image-2025-12-29-at-12-03-11-jpeg.jpeg`,
    sellerId: oranges.id,
    seller: oranges,
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-05-01",
    quantity: 12,
    createdAt: "2026-04-22",
  },
  {
    id: "l9",
    title: "Melnie ikri 56g",
    description: "Izsmalcināti melnie ikri — īsta greznība. Ideāls dāvanas vai svētku galdam.",
    price: 45.00,
    unit: "56g",
    category: "Jūras veltes",
    image: `${IMG}4632925WhatsApp-Image-2025-12-29-at-12-03-11-1-jpeg.jpeg`,
    sellerId: oranges.id,
    seller: oranges,
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-05-01",
    quantity: 5,
    createdAt: "2026-04-22",
  },
  {
    id: "l10",
    title: "Svaigā forele",
    description: "Svaiga forele (1–2 kg, iztīrīta) — no vietējās audzētavas. Cena 8,90 €/kg.",
    price: 8.90,
    unit: "kg",
    category: "Jūras veltes",
    image: `${IMG}7520361WhatsApp-Image-2025-12-29-at-12-05-31-jpeg.jpeg`,
    sellerId: oranges.id,
    seller: oranges,
    lockerId: "salaspils",
    locker: lockers[1],
    freshnessDate: "2026-04-26",
    quantity: 8,
    createdAt: "2026-04-22",
  },
  // ── Cake Break ───────────────────────────────────────────────────────────
  {
    id: "l11",
    title: 'Deserta torte "Svētku assorti" 700g',
    description: "Svētku deserta torte ar dažādu krēmu kārtu asortu. Svars 700g. Minimālais pasūtījums 25 €.",
    price: 9.00,
    unit: "700g",
    category: "Konditorija",
    image: `${IMG}8072049Deserta-torte-jpg.jpg`,
    sellerId: cakebreak.id,
    seller: cakebreak,
    lockerId: "ikskile",
    locker: lockers[5],
    freshnessDate: "2026-04-28",
    quantity: 6,
    createdAt: "2026-04-21",
  },
  {
    id: "l12",
    title: 'Šokolādes siera kūka "Suntažu Barons"',
    description: "Bagātīga šokolādes siera kūka ar krēmīgu tekstūru. Roku darbs no Suntažiem. 700g.",
    price: 11.00,
    unit: "700g",
    category: "Konditorija",
    image: `${IMG}7243124CB-CHOCO-VIZ-jpg.jpg`,
    sellerId: cakebreak.id,
    seller: cakebreak,
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-04-28",
    quantity: 4,
    createdAt: "2026-04-20",
  },
  {
    id: "l13",
    title: "Saldais Sapnis 700g",
    description: "Gaišs un krēmīgs deserts ar maigo vaniļas-krēmsiera pildījumu. Populārākā torte! 700g.",
    price: 10.00,
    unit: "700g",
    category: "Konditorija",
    image: `${IMG}1534890CB-SweetDream-viz-6a3390382caebd73d743966a25b74121-jpg.jpg`,
    sellerId: cakebreak.id,
    seller: cakebreak,
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-04-28",
    quantity: 5,
    createdAt: "2026-04-22",
  },
  // ── Ekoloģisks.lv ───────────────────────────────────────────────────────
  {
    id: "l14",
    title: "Kartupeļi Bio",
    description: "Bioloģiski audzēti kartupeļi no ekoloģiskas saimniecības. Pieejami no 1 kg līdz 20 kg.",
    price: 0.79,
    unit: "kg",
    category: "Dārzeņi",
    image: `${IMG}5425602DSC-0483-jpg.jpg`,
    sellerId: ekologisks.id,
    seller: ekologisks,
    lockerId: "salaspils",
    locker: lockers[1],
    freshnessDate: "2026-05-10",
    quantity: 50,
    createdAt: "2026-04-18",
  },
  {
    id: "l15",
    title: "Burkāni Bio",
    description: "Svaigi bioloģiski burkāni — saldi, kraukšķīgi, bez pesticīdiem. Pieejami dažādās iepakojuma lielumā.",
    price: 1.19,
    unit: "kg",
    category: "Dārzeņi",
    image: `${IMG}9431603DSC-0470-jpg.jpg`,
    sellerId: ekologisks.id,
    seller: ekologisks,
    lockerId: "ikskile",
    locker: lockers[5],
    freshnessDate: "2026-05-08",
    quantity: 30,
    createdAt: "2026-04-19",
  },
  // ── BURŽUJS ─────────────────────────────────────────────────────────────
  {
    id: "l16",
    title: "Austeres Fine CELINE, Francija",
    description: "Franču delikateses Fine de Claire austeres. Kastītē 12 vai 24 gabali. Lieliski svaigas vai grilētas.",
    price: 21.00,
    unit: "12 gab.",
    category: "Jūras veltes",
    image: `${IMG}9697209056-GarJanis-1x1-jpg.jpg`,
    sellerId: burzujs.id,
    seller: burzujs,
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-04-27",
    quantity: 10,
    createdAt: "2026-04-22",
  },
  {
    id: "l17",
    title: 'Austeres Super Speciale SELECTION OR (GOLD)',
    description: "Premium austeres no Francijas/Īrijas — kategorija Super Spéciale. Atzītas kā vienas no labākajām. 12 gab.",
    price: 44.00,
    unit: "12 gab.",
    category: "Jūras veltes",
    image: `${IMG}6566599063-GarJanis-1x1-jpg.jpg`,
    sellerId: burzujs.id,
    seller: burzujs,
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-04-27",
    quantity: 6,
    createdAt: "2026-04-21",
  },
];

export type Review = {
  id: string;
  listingId: string;
  buyerName: string;
  buyerAvatar: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string;
  date: string;
};

export const reviews: Review[] = [
  // l1 — Pelmeņi vegānie
  {
    id: "r1",
    listingId: "l1",
    buyerName: "Kristīne L.",
    buyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Lieliski vegānie pelmeņi! Garša pārsteidza — sulīgi un ar bagātu dārzeņu pildījumu. Pakomātā viss bija pareizā temperatūrā.",
    date: "2026-04-20",
  },
  {
    id: "r2",
    listingId: "l1",
    buyerName: "Mārtiņš K.",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Pasūtīju pirmo reizi un jau esmu pastāvīgais klients. Ātrs piegādes laiks, svaigi un garšīgi!",
    date: "2026-04-18",
  },
  {
    id: "r3",
    listingId: "l1",
    buyerName: "Ilze V.",
    buyerAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Labi pelmeņi, viegla vārīšana. Nākamreiz izmēģināšu brieža gaļas variantu.",
    date: "2026-04-15",
  },
  {
    id: "r4",
    listingId: "l1",
    buyerName: "Andris Z.",
    buyerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Vegānie pelmeņi uz vakariņām — perfekti! Bērniem arī ļoti garšoja. Iesaku.",
    date: "2026-04-10",
  },
  // l5 — Brieža steiks
  {
    id: "r5",
    listingId: "l5",
    buyerName: "Santa R.",
    buyerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Brieža steiks bija izcils! Marināde perfekta, gaļa maiga. Labākais ko esmu gatavojusi uz grilla.",
    date: "2026-04-21",
  },
  {
    id: "r6",
    listingId: "l5",
    buyerName: "Normunds B.",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Savvaļas gaļa ar autentisku garšu. Nevaru iedomāties kaut ko labāku BBQ sezonai.",
    date: "2026-04-17",
  },
  {
    id: "r7",
    listingId: "l5",
    buyerName: "Evija P.",
    buyerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Laba gaļa, marinēta ar mēru. Pakomātā saņemšana bija ērtākā pieredze.",
    date: "2026-04-12",
  },
  // l8 — Oranžie ikri
  {
    id: "r8",
    listingId: "l8",
    buyerName: "Jānis S.",
    buyerAvatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Izcili ikri! Svaigi, ar bagātu garšu. Perfekti uz blīniem Jaunajā gadā. Noteikti pasūtīšu vēlreiz.",
    date: "2026-04-19",
  },
  {
    id: "r9",
    listingId: "l8",
    buyerName: "Līga M.",
    buyerAvatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Labākais dāvanu variants gurmandam! Iepakojums elegants, garša — neaprakstāma.",
    date: "2026-04-14",
  },
  {
    id: "r10",
    listingId: "l8",
    buyerName: "Raimonds T.",
    buyerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Ļoti svaigi un garšīgi ikri. Pakomāts uzturēja pareizu temperatūru — svarīgi šādam produktam.",
    date: "2026-04-08",
  },
  // l11 — Torte
  {
    id: "r11",
    listingId: "l11",
    buyerName: "Aija K.",
    buyerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Pasūtīju dzimšanas dienai — visi bija sajūsmā! Torte skaista un neticami garšīga. Suntažu Cake Break ir labākā!",
    date: "2026-04-16",
  },
  {
    id: "r12",
    listingId: "l11",
    buyerName: "Valdis J.",
    buyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Mājas gatavošanas kvalitāte jūtama. Pakomātā saņemšana bija ļoti ērta. Iesaku visiem!",
    date: "2026-04-05",
  },
];

export const categories = [
  "Visi",
  "Gaļa",
  "Saldēta pārtika",
  "Jūras veltes",
  "Konditorija",
  "Dārzeņi",
  "Eļļas",
  "Dzērieni",
  "Olas",
];
