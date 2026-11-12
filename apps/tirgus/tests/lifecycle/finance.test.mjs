import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { database,seed,order,reserve,scalar,listing,seller } from "./database.mjs";
let db;
before(async()=>{db=await database();});
after(async()=>{await db?.close();});
beforeEach(async()=>{await seed(db);});
const operator=Object.fromEntries(["name","regNr","vatNr","address","phone","email","bankName","iban","bic","complaintsEmail"].map(k=>[k,`synthetic-${k}`]));
test("tax and pickup facts are captured from locked DB rows, never submitted financial overrides",async()=>{
  await db.exec("UPDATE sellers SET delivery_mode='courier'; UPDATE listings SET vat_rate=12");
  const payload=order({financial_snapshot:{operator}});
  payload.items[0].vat_rate=21; payload.items[0].seller_courier_fee_cents=0;
  await reserve(db,payload);
  assert.equal(await scalar(db,"SELECT items->0->>'vat_rate' FROM orders"),"12");
  assert.equal(await scalar(db,"SELECT items->0->>'seller_courier_fee_cents' FROM orders"),"350");
  assert.equal(await scalar(db,"SELECT financial_snapshot->>'requires_review' FROM orders"),"false");
  await db.exec("UPDATE listings SET vat_rate=21; UPDATE sellers SET delivery_mode='locker'");
  assert.equal(await scalar(db,"SELECT items->0->>'vat_rate' FROM orders"),"12");
  await assert.rejects(db.exec("UPDATE orders SET financial_snapshot='{}'"),/immutable/);
});
test("unknown tax/operator evidence stays unknown, never defaults to VAT21",async()=>{
  await db.exec("UPDATE sellers SET is_vat_registered=NULL");
  await reserve(db);
  assert.equal(await scalar(db,"SELECT items->0->'vat_rate' FROM orders"),null);
  assert.equal(await scalar(db,"SELECT financial_snapshot->>'requires_review' FROM orders"),"true");
});
test("non-VAT seller gets explicit zero VAT, not the product's current registered VAT rate",async()=>{
  await db.exec("UPDATE sellers SET is_vat_registered=false");
  await reserve(db);
  assert.equal(await scalar(db,"SELECT items->0->>'vat_rate' FROM orders"),"0");
});
test("manual refund needs exact already-received amount and external evidence; replay cannot refund twice",async()=>{
  const hold=await reserve(db);
  await db.query("UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1",[hold.order_id]);
  await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  const sql="SELECT marketplace_record_refund_v1($1,$2,$3,$4,$5,$6::timestamptz)";
  const args=[hold.order_id,listing,800,"synthetic-provider-reference","Verified synthetic external refund evidence","2026-01-01T00:00:00Z"];
  await assert.rejects(db.query(sql,[...args.slice(0,2),1,...args.slice(3)]),/evidence/);
  assert.equal(await scalar(db,sql,args),true);
  assert.equal(await scalar(db,sql,args),false);
  assert.equal(await scalar(db,"SELECT payment_status FROM orders"),"refunded");
  const conflict=[...args];conflict[3]="different-reference";
  await assert.rejects(db.query(sql,conflict),/Conflicting/);
});

test("self-billing header and lines are atomic, source-locked and repeat-safe",async()=>{
  const hold=await reserve(db,order({financial_snapshot:{operator}}));
  await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  const day=await scalar(db,"SELECT paid_at::date::text FROM orders");
  const header={seller_id:seller,period_start:day,period_end:day,total_gross_cents:500,
    total_ex_vat_cents:413,total_product_vat_cents:87,total_commission_cents:62,
    commission_vat_cents:13,commission_vat_rate:21,courier_fee_cents:0,courier_order_count:0,
    total_net_cents:425,seller_legal_name:"Synthetic seller",seller_bank_iban:"SYNTHETIC-NOT-A-BANK-ACCOUNT",
    operator_version:"izipizi-2026-09-01",operator_snapshot:operator,status:"draft"};
  const lines=[{order_id:hold.order_id,order_number:"TRG-SYNTHETIC",order_date:day,
    product_title:"Synthetic product",quantity:1,unit:"gab.",unit_price_cents:500,line_gross_cents:500,
    vat_rate:21,vat_amount_cents:87,ex_vat_cents:413,commission_rate:15,commission_cents:75,net_cents:425,line_order:0}];
  const sql="SELECT marketplace_create_invoice_v1($1::jsonb,$2::jsonb)";
  const args=[JSON.stringify(header),JSON.stringify(lines)];
  await db.exec(`CREATE FUNCTION fail_invoice_test() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'simulated line insert failure'; END $$;
    CREATE TRIGGER fail_invoice_test BEFORE INSERT ON invoice_lines FOR EACH ROW EXECUTE FUNCTION fail_invoice_test();`);
  await db.exec("SET ROLE service_role");
  await assert.rejects(db.query(sql,args),/simulated line/);
  await db.exec("RESET ROLE");
  assert.equal(await scalar(db,"SELECT count(*)::int FROM invoices"),0);
  await db.exec("DROP TRIGGER fail_invoice_test ON invoice_lines; SET ROLE service_role");
  const invoice=await scalar(db,sql,args);
  assert.ok(invoice.id);
  await assert.rejects(db.query(sql,args),/unique constraint/);
  await db.exec("RESET ROLE");
  assert.equal(await scalar(db,"SELECT count(*)::int FROM invoices"),1);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM invoice_lines"),1);
});
