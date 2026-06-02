-- ============================================================
-- Promo kodu sistēma + e-pasta pierakstīšanās
-- Palaid Supabase SQL Editor
-- ============================================================

-- 1. Profila free delivery kredīti
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_delivery_credits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS newsletter_consent boolean DEFAULT false;

-- 2. Promo kodu tabula
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'free_delivery',  -- 'free_delivery' | 'percent' | 'fixed'
  discount_cents integer DEFAULT 0,            -- for fixed discounts
  discount_percent integer DEFAULT 0,          -- for percent discounts
  max_uses integer DEFAULT 1,                  -- 0 = unlimited
  used_count integer DEFAULT 0,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Promo kodu izmantošanas žurnāls
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id uuid REFERENCES promo_codes(id),
  code text NOT NULL,
  user_id uuid,
  order_id uuid,
  order_number text,
  discount_cents integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. E-pasta abonentu tabula
CREATE TABLE IF NOT EXISTS email_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  source text DEFAULT 'banner',  -- 'banner' | 'profile' | 'checkout' | 'register'
  mailerlite_synced boolean DEFAULT false,
  subscribed_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz
);

-- 5. Ielikt noklusējuma "PIRMAIS" promo kodu (bezmaksas piegāde)
INSERT INTO promo_codes (code, type, max_uses, active)
VALUES ('PIRMAIS', 'free_delivery', 0, true)
ON CONFLICT (code) DO NOTHING;

-- 6. Iepriekšējās migrācijas (ja vēl nav)
CREATE TABLE IF NOT EXISTS delivery_lookups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  postal_code text,
  city text,
  address text,
  zone integer,
  outside_zones boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS courier_fee_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_order_count integer DEFAULT 0;
