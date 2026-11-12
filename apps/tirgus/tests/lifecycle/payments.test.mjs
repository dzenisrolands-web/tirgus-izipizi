import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { database, seed, reserve, scalar, listing } from "./database.mjs";
let db;
before(async()=>{db=await database();});
after(async()=>{await db?.close();});
beforeEach(async()=>{await seed(db);});
async function pay(amount=800) {
  return scalar(db,"SELECT marketplace_settle_v1('TRG-SYNTHETIC',$1)",[amount]);
}
test("payment, consumed inventory and one event commit together; replay is a no-op",async()=>{
  const reserved=await reserve(db);
  assert.equal((await pay()).outcome,"paid");
  const paidAt=await scalar(db,"SELECT paid_at FROM orders WHERE id=$1",[reserved.order_id]);
  assert.equal((await pay()).outcome,"already_paid");
  assert.deepEqual(await scalar(db,"SELECT paid_at FROM orders WHERE id=$1",[reserved.order_id]),paidAt);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM marketplace_events_v1"),1);
  assert.equal(await scalar(db,"SELECT marketplace_release_v1($1,'paid_cancel_attempt')",[reserved.order_id]),false);
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),0);
});
test("a paid expired order releases once and stays cancelled for financial review",async()=>{
  const reserved=await reserve(db);
  await db.query("UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1",[reserved.order_id]);
  assert.equal((await pay()).outcome,"review");
  assert.equal(await scalar(db,"SELECT status FROM orders"),"cancelled");
  assert.equal(await scalar(db,"SELECT payment_status FROM orders"),"paid");
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),1);
  await pay();
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),1);
  await assert.rejects(db.query("UPDATE orders SET status='processing'"),/evidence/);
});
test("wrong or conflicting received amount never unlocks fulfillment or overwrites first receipt",async()=>{
  await reserve(db);
  assert.equal((await pay(1)).outcome,"review");
  assert.equal(await scalar(db,"SELECT payment_received_cents FROM orders"),1);
  assert.equal((await pay(800)).outcome,"review");
  assert.equal(await scalar(db,"SELECT payment_received_cents FROM orders"),1);
  assert.equal(await scalar(db,"SELECT payment_review_reason FROM orders"),"conflicting_payment_receipt");
});
test("direct paid/cancelled changes cannot bypass holds, and fulfillment cannot skip steps",async()=>{
  await reserve(db);
  await assert.rejects(db.exec("UPDATE orders SET status='paid',payment_status='paid',paid_at=now()"),/evidence/);
  await assert.rejects(db.exec("UPDATE orders SET status='cancelled'"),/Release/);
  await pay();
  await assert.rejects(db.exec("UPDATE orders SET status='shipped'"),/evidence|sequential/);
  await db.exec("UPDATE orders SET status='processing'");
  await assert.rejects(db.exec("UPDATE orders SET status='shipped'"),/evidence/);
  await assert.rejects(db.exec("UPDATE orders SET total_cents=1"),/immutable/);
});
test("settlement never invents reservation evidence for a historical order",async()=>{
  await db.exec("INSERT INTO orders(order_number,status,payment_status,total_cents) VALUES('LEGACY','pending','awaiting',800)");
  await assert.rejects(db.query("SELECT marketplace_settle_v1('LEGACY',800)"),/target/);
  assert.equal(await scalar(db,"SELECT payment_status FROM orders"),"awaiting");
});
