// Minimal synthetic test schema, NOT a hosted Supabase schema export.
export const fixtureSchemaSql = `
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE sellers(id uuid PRIMARY KEY,status text,delivery_mode text,is_vat_registered boolean,home_locker_ids text[],
      user_id uuid DEFAULT '44444444-4444-4444-8444-444444444444',
      legal_name text DEFAULT 'Synthetic seller',registration_number text DEFAULT 'SYNTHETIC-REG',
      vat_number text DEFAULT 'SYNTHETIC-VAT',legal_address text DEFAULT 'Synthetic legal address',
      bank_name text DEFAULT 'Synthetic bank',bank_iban text DEFAULT 'SYNTHETIC-NOT-A-BANK-ACCOUNT',
      self_billing_agreed boolean DEFAULT true,self_billing_agreement_version text DEFAULT '2.0');
    CREATE TABLE listings(id uuid PRIMARY KEY,seller_id uuid REFERENCES sellers(id),status text,
      price numeric,quantity integer,variants jsonb,category text,storage_type text,
      courier_delivery boolean,express_delivery boolean,vat_rate numeric);
    CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text UNIQUE NOT NULL,
      status text,payment_status text,paid_at timestamptz,created_at timestamptz DEFAULT now(),payment_provider text,payment_session_id text,
      buyer_id uuid,buyer_name text,buyer_email text,buyer_phone text,delivery_type text,delivery_info jsonb,
      items jsonb,total_cents integer,total_amount numeric,seller_ids uuid[],promo_code text,promo_discount_cents integer);
    CREATE TABLE invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_number text UNIQUE,
      seller_id uuid,period_start date,period_end date,total_gross_cents integer,total_commission_cents integer,
      total_net_cents integer,seller_legal_name text,seller_reg_number text,seller_vat_number text,
      seller_legal_address text,seller_bank_name text,seller_bank_iban text,status text,
      UNIQUE(seller_id,period_start,period_end));
    CREATE TABLE invoice_lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid REFERENCES invoices(id),
      order_id uuid REFERENCES orders(id),order_number text,order_date date,product_title text,quantity integer,
      unit text,unit_price_cents integer,line_gross_cents integer,commission_rate numeric,
      commission_cents integer,net_cents integer,line_order integer);
    CREATE SEQUENCE invoice_numbers;
    CREATE FUNCTION next_invoice_number() RETURNS text LANGUAGE sql AS
      $$ SELECT 'TEST-'||nextval('invoice_numbers')::text $$;
    GRANT SELECT,INSERT ON invoices,invoice_lines TO service_role;
    GRANT USAGE ON SEQUENCE invoice_numbers TO service_role;
    GRANT SELECT,UPDATE ON orders TO service_role;
    GRANT SELECT,UPDATE ON sellers TO service_role;
  `;
