import { fixtureSchemaSql } from "./fixture-schema.mjs";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export const seller = "11111111-1111-4111-8111-111111111111";
export const listing = "22222222-2222-4222-8222-222222222222";
export const second = "33333333-3333-4333-8333-333333333333";
export async function database() {
  const db = new PGlite();
  await db.exec(fixtureSchemaSql);
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
