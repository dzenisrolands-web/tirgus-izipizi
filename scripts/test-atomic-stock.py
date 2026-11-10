#!/usr/bin/env python3
"""Run only in disposable, network-isolated Docker PG17; never accepts a DB URL."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = f"tirgus-stock-test-{uuid.uuid4().hex[:10]}"
LISTING = "20000000-0000-0000-0000-000000000002"
VARIANT = "20000000-0000-0000-0000-000000000003"


def command(*args, check=True):
    result = subprocess.run(args, text=True, capture_output=True, timeout=45)
    if check and result.returncode:
        raise AssertionError(f"{args}: {result.stdout}\n{result.stderr}")
    return result


def sql(query, check=True):
    return command("docker", "exec", CONTAINER, "psql", "-U", "postgres",
                   "-v", "ON_ERROR_STOP=1", "-At", "-c", query, check=check)


def parallel(*queries):
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as pool:
        return list(pool.map(lambda q: sql(q, check=False), queries))


def reserve(number, listing=LISTING):
    return f"SELECT create_reserved_marketplace_order(stock_test_order('{number}','{listing}'));"


def wait_for_sleep():
    for _ in range(100):
        if sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep'").stdout.strip() != "0":
            return
        time.sleep(0.03)
    raise AssertionError("Blocking fixture did not acquire its lock")


command("docker", "run", "--name", CONTAINER, "--network", "none",
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-d", "postgres:17-alpine")
for _ in range(100):
    if command("docker", "exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
        break
    time.sleep(0.1)
else:
    raise AssertionError("PG17 did not become ready")
command("docker", "cp", str(ROOT / "supabase"), f"{CONTAINER}:/tmp/supabase")
fixture = command("docker", "exec", CONTAINER, "psql", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-f", "/tmp/supabase/tests/atomic_stock_reservations.sql")
print(fixture.stderr.strip())

# Two independent DB sessions contend on the final base SKU. Exactly one order exists.
results = parallel(reserve("last-a"), reserve("last-b"))
assert sorted(r.returncode == 0 for r in results) == [False, True], results
assert sql(f"SELECT quantity FROM listings WHERE id='{LISTING}'").stdout.strip() == "0"
assert sql("SELECT count(*) FROM orders WHERE order_number IN ('last-a','last-b')").stdout.strip() == "1"
assert "Insufficient stock" in "".join(r.stderr for r in results)

# Final variant item, including plain/composite aliases, also has exactly one winner.
sql(f"UPDATE listings SET variants=jsonb_set(variants,'{{0,quantity}}','1') WHERE id='{VARIANT}'")
results = parallel(reserve("variant-a", VARIANT),
                   f"SELECT create_reserved_marketplace_order(stock_test_order('variant-b','{VARIANT}','{VARIANT}-small'));")
assert sorted(r.returncode == 0 for r in results) == [False, True], results
assert sql(f"SELECT variants->0->>'quantity' FROM listings WHERE id='{VARIANT}'").stdout.strip() == "0"

# Price is checked AFTER a competing writer commits, not from an unlocked prefetch.
sql(f"UPDATE listings SET quantity=1 WHERE id='{LISTING}'")
with concurrent.futures.ThreadPoolExecutor() as pool:
    writer = pool.submit(sql, f"BEGIN; UPDATE listings SET price=3 WHERE id='{LISTING}'; SELECT pg_sleep(1); COMMIT;")
    wait_for_sleep()
    stale = sql(reserve("stale-price"), check=False)
    writer.result()
assert stale.returncode != 0 and "Price changed" in stale.stderr, stale
assert sql(f"SELECT quantity FROM listings WHERE id='{LISTING}'").stdout.strip() == "1"
sql(f"UPDATE listings SET price=2 WHERE id='{LISTING}'")

# Approval is also rechecked while the seller lock is held.
with concurrent.futures.ThreadPoolExecutor() as pool:
    writer = pool.submit(sql, "BEGIN; UPDATE sellers SET status='rejected'; SELECT pg_sleep(1); COMMIT;")
    wait_for_sleep()
    stale = sql(reserve("stale-seller"), check=False)
    writer.result()
assert stale.returncode != 0 and "Seller unavailable" in stale.stderr, stale
sql("UPDATE sellers SET status='approved'")

# Thermal/category/home-locker changes cannot reuse an earlier delivery quote.
for field, old_value in [("category", "dairy"), ("storage_type", "chilled")]:
    with concurrent.futures.ThreadPoolExecutor() as pool:
        writer = pool.submit(sql, f"BEGIN; UPDATE listings SET {field}='changed' WHERE id='{LISTING}'; SELECT pg_sleep(1); COMMIT;")
        wait_for_sleep()
        stale = sql(f"""SELECT create_reserved_marketplace_order(jsonb_set(
          stock_test_order('stale-{field}','{LISTING}'),'{{items,0,{field}}}','"{old_value}"'));""", check=False)
        writer.result()
    assert stale.returncode != 0 and "Delivery quote metadata changed" in stale.stderr, stale
    sql(f"UPDATE listings SET {field}='{old_value}' WHERE id='{LISTING}'")
with concurrent.futures.ThreadPoolExecutor() as pool:
    writer = pool.submit(sql, "BEGIN; UPDATE sellers SET home_locker_ids=ARRAY['changed']; SELECT pg_sleep(1); COMMIT;")
    wait_for_sleep()
    stale = sql(f"""SELECT create_reserved_marketplace_order(jsonb_set(
      stock_test_order('stale-home','{LISTING}'),'{{items,0,seller_home_locker_ids}}','[]'));""", check=False)
    writer.result()
assert stale.returncode != 0 and "Delivery quote metadata changed" in stale.stderr, stale
sql("UPDATE sellers SET home_locker_ids='{}'")

# A duplicate callback race claims payment exactly once.
sql(reserve("callback"))
callbacks = parallel(*["SELECT settle_reserved_marketplace_order('callback',500)" for _ in range(2)])
assert all(r.returncode == 0 for r in callbacks), callbacks
assert sorted(json.loads(r.stdout)["outcome"] for r in callbacks) == ["already_paid", "paid"]
assert sql(f"SELECT quantity FROM listings WHERE id='{LISTING}'").stdout.strip() == "0"

# Cancel/payment races may consume OR release but never both; cancelled+paid is reviewed.
for i in range(10):
    sql(f"UPDATE listings SET quantity=1 WHERE id='{LISTING}'")
    sql(reserve(f"race-{i}"))
    races = parallel(
        f"SELECT settle_reserved_marketplace_order('race-{i}',500)",
        f"SELECT cancel_reserved_order(id,'buyer_cancelled') FROM orders WHERE order_number='race-{i}'")
    assert all(r.returncode == 0 for r in races), races
    state = sql(f"""SELECT json_build_object('stock',l.quantity,'status',o.status,'payment',o.payment_status,
      'review',o.payment_review_reason,'hold',r.state) FROM orders o JOIN marketplace_stock_reservations r
      ON r.order_id=o.id JOIN listings l ON l.id=r.listing_id WHERE o.order_number='race-{i}'""")
    data = json.loads(state.stdout)
    assert data["payment"] == "paid", data
    assert (data["status"], data["stock"], data["hold"]) in [
        ("paid", 0, "consumed"), ("cancelled", 1, "released")], data
    assert data["status"] != "cancelled" or data["review"], data

# Expiry/payment races are always reviewed after the deadline; stock released once.
for i in range(10):
    sql(f"UPDATE listings SET quantity=1 WHERE id='{LISTING}'")
    sql(reserve(f"expiry-race-{i}"))
    sql(f"UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE order_number='expiry-race-{i}'")
    races = parallel(f"SELECT settle_reserved_marketplace_order('expiry-race-{i}',500)",
                     "SELECT expire_marketplace_reservations()")
    assert all(r.returncode == 0 for r in races), races
    assert json.loads(races[0].stdout)["outcome"] == "review"
    assert sql(f"SELECT quantity FROM listings WHERE id='{LISTING}'").stdout.strip() == "1"

print(f"PASS: PG17 base/variant one-winner, locked price/seller recheck, callbacks, 20 lifecycle races ({CONTAINER})")
