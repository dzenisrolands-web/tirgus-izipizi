import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export const seller = "11111111-1111-4111-8111-111111111111";
export const listing = "22222222-2222-4222-8222-222222222222";
export const second = "33333333-3333-4333-8333-333333333333";
export async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE sellers(id uuid PRIMARY KEY,status text,delivery_mode text,is_vat_registered boolean,home_locker_ids text[]);
    CREATE TABLE listings(id uuid PRIMARY KEY,seller_id uuid REFERENCES sellers(id),status text,
      price numeric,quantity integer,variants jsonb,category text,storage_type text,
      courier_delivery boolean,express_delivery boolean,vat_rate numeric);
    CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text UNIQUE NOT NULL,
      status text,payment_status text,paid_at timestamptz,payment_provider text,payment_session_id text,
      buyer_id uuid,buyer_name text,buyer_email text,buyer_phone text,delivery_type text,delivery_info jsonb,
      items jsonb,total_cents integer,total_amount numeric,seller_ids uuid[],promo_code text,promo_discount_cents integer);
  `);
  const root = new URL("../../../../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(root).filter(file => file.startsWith("20261112")).sort()) {
    await db.exec(readFileSync(new URL(file, root), "utf8"));
  }
  return db;
}
export async function seed(db) {
  await db.exec(`TRUNCATE orders,listings,sellers CASCADE;
    INSERT INTO sellers VALUES('${seller}','approved','locker',true,ARRAY['brivibas']);
    INSERT INTO listings VALUES('${listing}','${seller}','active',5,1,'[]','Maize','chilled',true,true,21);
    INSERT INTO listings VALUES('${second}','${seller}','active',7,3,'[]','Maize','chilled',true,true,12);`);
}
export function order(extra = {}) {
  return {
    order_number: "TRG-SYNTHETIC", buyer_id: null, buyer_name: "Synthetic Buyer",
    buyer_email: "buyer@example.invalid", buyer_phone: "+37100000000",
    delivery_type: "locker", delivery_info: { locker_id: "brivibas", delivery_fee_cents: 300 },
    items: [{ id: listing, listing_id: listing, variant_id: null, price: 5, quantity: 1,
      seller_id: seller, category: "Maize", storage_type: "chilled" }],
    seller_ids: [seller], total_cents: 800, promo_discount_cents: 0, ...extra,
  };
}
export async function reserve(db, payload = order()) {
  return (await db.query("SELECT marketplace_reserve_v1($1::jsonb) AS result", [JSON.stringify(payload)])).rows[0].result;
}
export async function scalar(db, sql, args = []) { return Object.values((await db.query(sql,args)).rows[0])[0]; }
