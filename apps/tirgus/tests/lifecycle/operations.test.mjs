import { before,after,beforeEach,test } from "node:test";
import assert from "node:assert/strict";
import { database,seed,reserve,scalar,listing } from "./database.mjs";
let db;
before(async()=>{db=await database();});after(async()=>{await db?.close();});beforeEach(async()=>{await seed(db);});
test("paid cancellation preserves receipt and consumed goods; it is not a refund or restock",async()=>{
  const hold=await reserve(db);await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  const result=await scalar(db,"SELECT marketplace_transition_v1($1,'paid','cancelled',$2,'Synthetic cancellation evidence')",[hold.order_id,listing]);
  assert.equal(result.payment_status,"paid");
  assert.equal(await scalar(db,"SELECT payment_received_cents FROM orders"),800);
  assert.equal(await scalar(db,"SELECT payment_review_reason FROM orders"),"refund_required");
  assert.equal(await scalar(db,"SELECT quantity FROM listings WHERE id=$1",[listing]),0);
  assert.equal(await scalar(db,"SELECT state FROM marketplace_reservations_v1"),"consumed");
});
test("automatic paid cancellation requires the actual 72h policy and cannot erase money",async()=>{
  const hold=await reserve(db);await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  const sql="SELECT marketplace_transition_v1($1,'paid','cancelled',NULL,'auto_cancel_unconfirmed_72h')";
  await assert.rejects(db.query(sql,[hold.order_id]),/operator/);
  await db.exec("UPDATE orders SET paid_at=now()-interval '73 hours'");
  assert.equal((await scalar(db,sql,[hold.order_id])).status,"cancelled");
  assert.equal(await scalar(db,"SELECT payment_status FROM orders"),"paid");
});
test("full synthetic processing/handoff/shipped/delivered cycle records events, not fabricated provider POD",async()=>{
  const hold=await reserve(db);await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  const transition=(expected,next)=>scalar(db,"SELECT marketplace_transition_v1($1,$2,$3,$4,'Synthetic operator evidence reference')",[hold.order_id,expected,next,listing]);
  await transition("paid","processing");
  await assert.rejects(transition("processing","shipped"),/acknowledgement/);
  await db.query("SELECT marketplace_prepare_handoff_v1($1,$2)",[hold.order_id,listing]);
  const job=await scalar(db,"SELECT marketplace_claim_handoff_v1($1)",[hold.order_id]);
  await db.query("SELECT marketplace_finish_handoff_v1($1,$2,$3,true)",[hold.order_id,job.claim_token,listing]);
  await transition("processing","shipped");await transition("shipped","delivered");
  assert.equal(await scalar(db,"SELECT status FROM orders"),"delivered");
  assert.equal(await scalar(db,"SELECT count(*)::int FROM marketplace_transition_evidence_v1"),3);
});
