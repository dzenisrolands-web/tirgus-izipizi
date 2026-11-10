-- DISPOSABLE DATABASE ONLY. Never run against an application/production database.
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF current_database() NOT LIKE 'tirgus_release_%' OR to_regclass('public.orders') IS NOT NULL THEN
    RAISE EXCEPTION 'A fresh isolated tirgus_release_* database is required';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT nullif(current_setting('test.uid',true),'')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$
  SELECT coalesce(current_setting('test.admin',true),'')='true'
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth,public TO anon,authenticated,service_role;
CREATE TABLE public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id),
  name text, farm_name text, status text DEFAULT 'approved', verified boolean DEFAULT false,
  location text, description text, short_desc text, avatar_url text, cover_url text, logo_url text,
  youtube_video_url text,youtube_video_id text,website text,facebook text,instagram text,
  tiktok text,youtube_channel text,rating numeric,review_count integer,approved_at timestamptz,
  approved_by uuid,rejected_at timestamptz,rejected_reason text,admin_notes text,
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),slug text,
  quote_text text,quote_author text,home_locker_ids text[] DEFAULT ARRAY['brivibas'],
  facts jsonb,milestones jsonb,events jsonb,delivery_mode text DEFAULT 'locker',
  courier_pickup_address text,is_vat_registered boolean DEFAULT true,
  legal_name text,registration_number text,vat_number text,legal_address text,
  bank_name text,bank_iban text,bank_swift text,self_billing_agreed boolean DEFAULT true,
  self_billing_agreed_at timestamptz,self_billing_agreement_version text DEFAULT '3.0'
);
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),seller_id uuid REFERENCES public.sellers(id),
  user_id uuid,title text NOT NULL,description text,price numeric NOT NULL,quantity integer NOT NULL,
  unit text DEFAULT 'gab.',status text DEFAULT 'active',variants jsonb DEFAULT '[]',
  vat_rate integer DEFAULT 21,category text DEFAULT 'Saldēta pārtika',storage_type text DEFAULT 'frozen',
  courier_delivery boolean DEFAULT true,express_delivery boolean DEFAULT true,
  locker_id text DEFAULT 'brivibas',image_url text,created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),commission_rate numeric DEFAULT 15,
  commission_status text DEFAULT 'approved',commission_approved_at timestamptz,
  commission_approved_by uuid,dispatch_days text[],slug text
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',payment_status text NOT NULL DEFAULT 'awaiting',
  payment_provider text,payment_session_id text,buyer_id uuid,buyer_name text,buyer_email text,buyer_phone text,
  delivery_type text,delivery_info jsonb,items jsonb,seller_ids uuid[],total_cents integer,
  total_amount numeric,paid_at timestamptz,created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),promo_code text,promo_discount_cents integer DEFAULT 0,
  locker_code text,auto_cancelled_at timestamptz,seller_reminded_count integer DEFAULT 0,
  seller_reminded_at timestamptz
);
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_number text UNIQUE NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id),period_start date NOT NULL,period_end date NOT NULL,
  total_gross_cents integer NOT NULL,total_commission_cents integer NOT NULL,total_net_cents integer NOT NULL,
  vat_rate numeric,vat_amount_cents integer,status text NOT NULL DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),paid_at timestamptz,
  seller_legal_name text,seller_reg_number text,seller_vat_number text,seller_legal_address text,
  seller_bank_name text,seller_bank_iban text,UNIQUE(seller_id,period_start,period_end)
);
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),order_number text,order_date date NOT NULL,
  product_title text NOT NULL,quantity numeric(10,3) NOT NULL,unit text,unit_price_cents integer NOT NULL,
  line_gross_cents integer NOT NULL,commission_rate numeric(5,2) NOT NULL,
  commission_cents integer NOT NULL,net_cents integer NOT NULL,line_order integer NOT NULL
);
CREATE TABLE public.invoice_sequence(prefix text,year integer,last_number integer,PRIMARY KEY(prefix,year));
CREATE FUNCTION public.next_invoice_number() RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer; y integer:=extract(year from now()); BEGIN
  INSERT INTO public.invoice_sequence VALUES('TIR-',y,1)
  ON CONFLICT(prefix,year) DO UPDATE SET last_number=invoice_sequence.last_number+1
  RETURNING last_number INTO n;
  RETURN 'TIR-'||y||'-'||lpad(n::text,4,'0');
END $$;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sellers_owner ON public.sellers TO authenticated USING (user_id=auth.uid());
CREATE POLICY orders_owner ON public.orders TO authenticated USING (buyer_id=auth.uid());
CREATE POLICY orders_seller ON public.orders TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id=auth.uid() AND s.id=ANY(orders.seller_ids))
);
CREATE POLICY listings_public ON public.listings FOR SELECT TO anon,authenticated USING(status='active');
GRANT SELECT ON public.listings TO anon,authenticated;
GRANT SELECT,UPDATE ON public.sellers,public.orders TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
\ir ../migrations/0035_sellers_public_view.sql
