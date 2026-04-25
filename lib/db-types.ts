export type DBSeller = {
  id: string;
  slug: string | null;
  user_id: string | null;
  name: string;
  description: string | null;
  short_desc: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube_video_id: string | null;
  quote_text: string | null;
  quote_author: string | null;
  rating: number | null;
  review_count: number | null;
  verified: boolean;
  status: string;
  created_at: string;
};

export type DBListing = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  unit: string;
  category: string | null;
  image_url: string | null;
  locker_id: string | null;
  quantity: number;
  status: string;
  freshness_date: string | null;
  seller_id: string | null;
  sellers: {
    id: string;
    slug: string | null;
    name: string;
    logo_url: string | null;
    rating: number | null;
    review_count: number | null;
    verified: boolean;
    location: string | null;
  } | null;
};

// Flat type that ListingCard accepts
export type CardListing = {
  id: string;
  title: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  freshnessDate?: string;
  seller: {
    name: string;
    verified: boolean;
    rating: number;
    farmName: string;
  };
  locker: {
    city: string;
    name: string;
  };
};
