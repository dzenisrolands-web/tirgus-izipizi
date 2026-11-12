import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export const seller = "11111111-1111-4111-8111-111111111111";
export const listing = "22222222-2222-4222-8222-222222222222";
export const second = "33333333-3333-4333-8333-333333333333";
export async function database() {
  const db = new PGlite();
  await db.exec(`
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
  `);
  const root = new URL("../../../../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(root).filter(file => file.startsWith("20261112")).sort()) {
    await db.exec(readFileSync(new URL(file, root), "utf8"));
  }
  return db;
}
export async function seed(db) {
  await db.exec(`TRUNCATE invoices,orders,listings,sellers CASCADE;
    INSERT INTO sellers(id,status,delivery_mode,is_vat_registered,home_locker_ids) VALUES('${seller}','approved','locker',true,ARRAY['brivibas']);
    INSERT INTO listings VALUES('${listing}','${seller}','active',5,1,'[]','Maize','chilled',true,true,21);
    INSERT INTO listings VALUES('${second}','${seller}','active',7,3,'[]','Maize','chilled',true,true,12);`);
}
export function order(extra = {}) {
  return {
    order_number: "TRG-SYNTHETIC", buyer_id: null, buyer_name: "Synthetic Buyer",
    buyer_email: "buyer@example.invalid", buyer_phone: "+37100000000",
    delivery_type: "locker", delivery_info: { locker_id: "brivibas", delivery_fee_cents: 300 },
    items: [{ id: listing, listing_id: listing, variant_id: null, title: "Synthetic product", price: 5, quantity: 1,
      seller_id: seller, category: "Maize", storage_type: "chilled", source_storage_type: "chilled" }],
    seller_ids: [seller], total_cents: 800, promo_discount_cents: 0, ...extra,
  };
}
export async function reserve(db, payload = order()) {
  return (await db.query("SELECT marketplace_reserve_v1($1::jsonb) AS result", [JSON.stringify(payload)])).rows[0].result;
}
export async function scalar(db, sql, args = []) { return Object.values((await db.query(sql,args)).rows[0])[0]; }
