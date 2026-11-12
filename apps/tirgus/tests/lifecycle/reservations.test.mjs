import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { database, seed, order, reserve, scalar, listing, second } from "./database.mjs";
let db;
before(async () => { db = await database(); });
after(async () => { await db?.close(); });
beforeEach(async () => { await seed(db); });

test("real PostgreSQL transaction reserves last item; second purchase cannot oversell", async () => {
  const result = await reserve(db);
  assert.ok(result.order_id);
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),0);
  await assert.rejects(reserve(db,order({ order_number:"TRG-SECOND" })),/stock/);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM orders"),1);
});
test("a later SKU failure rolls back earlier decrements and order creation", async () => {
  const payload = order();
  payload.items.push({ ...payload.items[0],id:second,listing_id:second,price:7,quantity:9 });
  payload.total_cents=7100;
  await assert.rejects(reserve(db,payload),/stock/);
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),1);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM orders"),0);
});
test("variant identity is explicit, never inferred from first array element or cart alias", async () => {
  await db.query("UPDATE listings SET variants=$1 WHERE id=$2",[JSON.stringify([
    {id:"small",price:5,quantity:2},{id:"large",price:8,quantity:1},
  ]),listing]);
  await assert.rejects(reserve(db),/variant/);
  const payload=order(); payload.items[0].variant_id="large"; payload.items[0].price=8; payload.total_cents=1100;
  const result=await reserve(db,payload);
  assert.equal(await scalar(db,"SELECT variants->1->>'quantity' FROM listings WHERE id=$1",[listing]),"0");
  await assert.rejects(db.query("UPDATE listings SET variants='[]' WHERE id=$1",[listing]),/held SKU/);
  await db.query("SELECT marketplace_release_v1($1,'buyer_cancelled')",[result.order_id]);
  await db.query("SELECT marketplace_release_v1($1,'retry_cancelled')",[result.order_id]);
  assert.equal(await scalar(db,"SELECT variants->1->>'quantity' FROM listings WHERE id=$1",[listing]),"1");
});
test("price, duplicate identity, seller and quote fact changes fail atomically", async () => {
  for (const mutate of [
    p=>{p.items[0].price=1;},
    p=>{p.items.push({...p.items[0]});},
    p=>{p.items[0].storage_type="frozen";},
    p=>{p.items[0].id="cart-key";},
    p=>{p.total_cents=1;},
    p=>{p.items[0].quantity=0.5;},
  ]) {
    const payload=order(); mutate(payload);
    await assert.rejects(reserve(db,payload));
    assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),1);
  }
});
test("expired hold is released once; historical order is not changed by release", async () => {
  const result=await reserve(db);
  await db.query("UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1",[result.order_id]);
  assert.equal(await scalar(db,"SELECT marketplace_expire_v1()"),1);
  assert.equal(await scalar(db,"SELECT marketplace_expire_v1()"),0);
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),1);
  await db.exec("INSERT INTO orders(order_number,status,payment_status) VALUES('LEGACY','pending','awaiting')");
  assert.equal(await scalar(db,"SELECT marketplace_release_v1(id,'historical') FROM orders WHERE order_number='LEGACY'"),false);
  assert.equal(await scalar(db,"SELECT status FROM orders WHERE order_number='LEGACY'"),"pending");
});
test("anonymous and authenticated roles cannot execute inventory RPCs or read reservations", async () => {
  for (const role of ["anon","authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(reserve(db),/permission denied/);
    await assert.rejects(db.query("SELECT * FROM marketplace_reservations_v1"),/permission denied/);
    await db.exec("RESET ROLE");
  }
});
