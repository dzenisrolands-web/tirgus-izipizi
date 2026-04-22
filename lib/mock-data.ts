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
    id: "s1",
    name: "Jānis Bērziņš",
    farmName: "Bērziņu saimniecība",
    avatar: "https://images.unsplash.com/photo-1559181567-c3190ca9d35b?w=80&h=80&fit=crop",
    verified: true,
    rating: 4.9,
    reviewCount: 47,
    location: "Pierīgas novads",
  },
  {
    id: "s2",
    name: "Anna Kalniņa",
    farmName: "Kalniņu piensaimniecība",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
    verified: true,
    rating: 4.8,
    reviewCount: 32,
    location: "Tukuma novads",
  },
  {
    id: "s3",
    name: "Pēteris Ozols",
    farmName: "Ozolu ferma",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
    verified: true,
    rating: 5.0,
    reviewCount: 18,
    location: "Salaspils novads",
  },
  {
    id: "s4",
    name: "Marta Liepiņa",
    farmName: "Liepiņu biškopība",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
    verified: false,
    rating: 4.7,
    reviewCount: 9,
    location: "Ikšķiles novads",
  },
];

export const listings: Listing[] = [
  {
    id: "l1",
    title: "Bioloģiskie tomāti",
    description: "Svaigi bioloģiskie tomāti no siltumnīcas. Audzēti bez pesticīdiem, bagāti ar garšu.",
    price: 3.50,
    unit: "kg",
    category: "Dārzeņi",
    image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&h=540&fit=crop",
    sellerId: "s1",
    seller: sellers[0],
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-04-25",
    quantity: 10,
    createdAt: "2026-04-22",
  },
  {
    id: "l2",
    title: "Mājas biezpiens",
    description: "Svaigs mājas biezpiens no pašu govīm. Trekns, kremīgs, bez piedevām.",
    price: 4.20,
    unit: "kg",
    category: "Piena produkti",
    image: "https://images.unsplash.com/photo-1559561853-08451507cbe7?w=400&h=540&fit=crop",
    sellerId: "s2",
    seller: sellers[1],
    lockerId: "brivibas",
    locker: lockers[0],
    freshnessDate: "2026-04-24",
    quantity: 5,
    createdAt: "2026-04-22",
  },
  {
    id: "l3",
    title: "Svaigas brūnās olas",
    description: "Brīvgaitas vistas olas. Dzeltens, spilgts dzeltenums – dabīgs uzturs bez piedevām.",
    price: 2.80,
    unit: "12 gab.",
    category: "Olas",
    image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&h=540&fit=crop",
    sellerId: "s3",
    seller: sellers[2],
    lockerId: "salaspils",
    locker: lockers[1],
    freshnessDate: "2026-04-30",
    quantity: 20,
    createdAt: "2026-04-21",
  },
  {
    id: "l4",
    title: "Liepziedu medus",
    description: "Tīrs liepziedu medus no Ikšķiles biškopības. Aromātisks, dzidrs, vietējs.",
    price: 8.50,
    unit: "350g",
    category: "Medus",
    image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400&h=540&fit=crop",
    sellerId: "s4",
    seller: sellers[3],
    lockerId: "ikskile",
    locker: lockers[5],
    freshnessDate: "2026-12-31",
    quantity: 8,
    createdAt: "2026-04-20",
  },
  {
    id: "l5",
    title: "Svaigi burkāni",
    description: "Tikko izrakti burkāni no lauka. Saldi, kraukšķīgi, bez zemes.",
    price: 1.50,
    unit: "kg",
    category: "Dārzeņi",
    image: "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=400&h=540&fit=crop",
    sellerId: "s1",
    seller: sellers[0],
    lockerId: "salaspils",
    locker: lockers[1],
    freshnessDate: "2026-04-27",
    quantity: 15,
    createdAt: "2026-04-22",
  },
  {
    id: "l6",
    title: "Mājas cietais siers",
    description: "Tradicionāls latviesu cietais siers, nogatavināts 3 mēnešus. Bagāta garša.",
    price: 6.00,
    unit: "200g",
    category: "Piena produkti",
    image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=540&fit=crop",
    sellerId: "s2",
    seller: sellers[1],
    lockerId: "tukums",
    locker: lockers[3],
    freshnessDate: "2026-05-15",
    quantity: 6,
    createdAt: "2026-04-19",
  },
  {
    id: "l7",
    title: "Āboli (Antonovka)",
    description: "Ziemas āboli no vecās saimniecības dārza. Skābi-saldi, lieliski cepšanai.",
    price: 2.00,
    unit: "kg",
    category: "Augļi",
    image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&h=540&fit=crop",
    sellerId: "s1",
    seller: sellers[0],
    lockerId: "agenskalna",
    locker: lockers[2],
    freshnessDate: "2026-05-01",
    quantity: 12,
    createdAt: "2026-04-22",
  },
  {
    id: "l8",
    title: "Marinēti gurķi",
    description: "Mājas marinēti gurķi ar dillēm un ķiplokiem. Tradicionāla recepte, 0,7L burka.",
    price: 3.00,
    unit: "burka",
    category: "Konservi",
    image: "https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?w=400&h=540&fit=crop",
    sellerId: "s2",
    seller: sellers[1],
    lockerId: "dundaga",
    locker: lockers[4],
    freshnessDate: "2026-12-31",
    quantity: 10,
    createdAt: "2026-04-18",
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
  // l1 — Bioloģiskie tomāti (4 reviews)
  {
    id: "r1",
    listingId: "l1",
    buyerName: "Kristīne L.",
    buyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Izcili tomāti! Garša kā no vecmāmiņas dārza. Pakomātā viss bija kārtīgi iepakots, auksts. Noteikti pasūtīšu vēlreiz.",
    date: "2026-04-20",
  },
  {
    id: "r2",
    listingId: "l1",
    buyerName: "Mārtiņš K.",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Ļoti svaigi, sulīgi. Lielāki nekā gaidīju. Pārdevējs ātri ielika pakomātā.",
    date: "2026-04-18",
  },
  {
    id: "r3",
    listingId: "l1",
    buyerName: "Ilze V.",
    buyerAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Labi produkti, svaigi un garšīgi. Viens tomāts bija nedaudz saspiests, bet pārējie perfekti.",
    date: "2026-04-15",
  },
  {
    id: "r4",
    listingId: "l1",
    buyerName: "Andris Z.",
    buyerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Ātrā saņemšana, lieliska garša. Biezpiens no tās pašas saimniecības arī labs — ieteiktu abus!",
    date: "2026-04-10",
  },
  // l2 — Mājas biezpiens (3 reviews)
  {
    id: "r5",
    listingId: "l2",
    buyerName: "Santa R.",
    buyerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Vislabākais biezpiens ko esmu ēdusi. Tik krēmīgs! Pakomātā temperatura bija pareiza, viss svaigs.",
    date: "2026-04-21",
  },
  {
    id: "r6",
    listingId: "l2",
    buyerName: "Normunds B.",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Ļoti labs produkts. Gatavoju syrniki — iznāca lieliski. Porcija varētu būt nedaudz lielāka.",
    date: "2026-04-17",
  },
  {
    id: "r7",
    listingId: "l2",
    buyerName: "Evija P.",
    buyerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Mājas garša, neko teikt! Bērniem ļoti garšoja ar medu. Paldies Annas saimniecībai!",
    date: "2026-04-12",
  },
  // l3 — Olas (3 reviews)
  {
    id: "r8",
    listingId: "l3",
    buyerName: "Jānis S.",
    buyerAvatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Dzeltenums tik dzeltens kā saulīte! Redzams, ka vistas brīvi staigā. Noteikti atkal pasūtīšu.",
    date: "2026-04-19",
  },
  {
    id: "r9",
    listingId: "l3",
    buyerName: "Līga M.",
    buyerAvatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Ideālas olas omletei. Garšīgākas par veikala olām vairākkārt. Pārdevējs atsaucīgs.",
    date: "2026-04-14",
  },
  {
    id: "r10",
    listingId: "l3",
    buyerName: "Raimonds T.",
    buyerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Labas olas, svaigi un kārtīgi iepakoti. Pakomāts bija ērti sasniedzams.",
    date: "2026-04-08",
  },
  // l4 — Medus (2 reviews)
  {
    id: "r11",
    listingId: "l4",
    buyerName: "Aija K.",
    buyerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Aromāts neticams, tīrs liepziedu medus. Burciņa izskatās profesionāli. Dāvana draudzenei!",
    date: "2026-04-16",
  },
  {
    id: "r12",
    listingId: "l4",
    buyerName: "Valdis J.",
    buyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Autentisks vietējais medus. Ēdam katru rītu ar tēju. Iesaku ikvienam!",
    date: "2026-04-05",
  },
];

export const categories = [
  "Visi",
  "Dārzeņi",
  "Augļi",
  "Piena produkti",
  "Gaļa",
  "Olas",
  "Medus",
  "Maizes izstrādājumi",
  "Konservi",
];
