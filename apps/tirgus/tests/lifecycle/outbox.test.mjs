import { before,after,beforeEach,test } from "node:test";
import assert from "node:assert/strict";
import { database,seed,reserve,scalar } from "./database.mjs";
let db;
before(async()=>{db=await database();});after(async()=>{await db?.close();});beforeEach(async()=>{await seed(db);});
async function paid() { await reserve(db);await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)"); }
test("payment creates one buyer and one seller job in the same commit, callback replay adds none",async()=>{
  await paid();
  assert.equal(await scalar(db,"SELECT count(*)::int FROM marketplace_outbox_v1"),2);
  await db.exec("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
  assert.equal(await scalar(db,"SELECT count(*)::int FROM marketplace_outbox_v1"),2);
});
test("claims fence workers; accepted job cannot be resent, missing reference cannot claim success",async()=>{
  await paid();
  const job=await scalar(db,"SELECT marketplace_claim_email_v1()");
  assert.ok(job.claim_token);
  const sql="SELECT marketplace_finish_email_v1($1,$2,$3,$4)";
  assert.equal(await scalar(db,sql,[job.id,job.id,"accepted","provider-reference"]),false);
  await assert.rejects(db.query(sql,[job.id,job.claim_token,"accepted",null]),/outcome/);
  assert.equal(await scalar(db,sql,[job.id,job.claim_token,"accepted","provider-reference"]),true);
  assert.equal(await scalar(db,sql,[job.id,job.claim_token,"accepted","provider-reference"]),false);
  const next=await scalar(db,"SELECT marketplace_claim_email_v1()");
  assert.notEqual(next.id,job.id);
});
test("crash after an uncertain send expires into review, never automatic resend",async()=>{
  await paid();
  const job=await scalar(db,"SELECT marketplace_claim_email_v1()");
  await db.query("UPDATE marketplace_outbox_v1 SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
  await db.exec("SELECT marketplace_claim_email_v1()");
  assert.equal(await scalar(db,"SELECT state FROM marketplace_outbox_v1 WHERE id=$1",[job.id]),"review");
  assert.equal(await scalar(db,"SELECT attempts FROM marketplace_outbox_v1 WHERE id=$1",[job.id]),1);
});
