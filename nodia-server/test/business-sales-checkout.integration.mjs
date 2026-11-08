import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AddDirectSaleCheckout1793420000000 } from '../dist/migrations/1793420000000-AddDirectSaleCheckout.js';

/** Runs only against the disposable database owned by business-sales.integration.mjs. */
export async function verifyDirectSaleCheckout({
  db,
  mutate,
  read,
  actor,
  other,
  check,
  httpBase,
}) {
  const business = randomUUID();
  await db.query('INSERT INTO businesses(id,owner_id) VALUES($1,1)', [
    business,
  ]);
  const [paid, zero, unavailable, unknown] = await db.query(
    `
    INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,barcode,has_stock)
    VALUES($1,'checkout-paid','Checkout paid',800,952,30,1500,7,'000017',true),
      ($1,'checkout-zero','Checkout zero',0,0,0,0,0,null,true),
      ($1,'checkout-unavailable','Checkout unavailable',0,0,0,100,4,null,false),
      ($1,'checkout-unknown','Checkout unknown',0,0,0,100,4,null,null)
    RETURNING id::text`,
    [business],
  );
  const item = (id = paid.id, price = '1500', version = 1, quantity = 1) => ({
    product_id: id,
    quantity,
    expected_product_version: version,
    expected_unit_price: price,
  });
  const run = (command, who = actor, manager) =>
    mutate.execute(business, 'checkout', command, who, manager);
  const counts = async () =>
    (
      await db.query(
        `SELECT
    (SELECT count(*)::text FROM sales WHERE business_id=$1) AS sales,
    (SELECT count(*)::text FROM sale_items WHERE business_id=$1) AS items,
    (SELECT count(*)::text FROM sale_mutation_requests WHERE business_id=$1) AS receipts,
    (SELECT count(*)::text FROM sale_events WHERE business_id=$1) AS events`,
        [business],
      )
    )[0];
  const unchanged = async (command, pattern) => {
    const before = await counts();
    await assert.rejects(() => run(command), pattern);
    assert.deepEqual(await counts(), before);
    assert.deepEqual(await read.receipt(business, command.request_key, actor), {
      status: 'unconfirmed',
    });
  };
  const productsBefore = await db.query(
    'SELECT id::text,stock,has_stock,version FROM products WHERE business_id=$1 ORDER BY id',
    [business],
  );
  let completed;
  const command = {
    request_key: randomUUID(),
    items: [item(paid.id, '1500', 1, 2), item(zero.id, '0')],
    payment_method: 'bank_transfer',
  };

  await check(
    'checkout concurrently commits one completed aggregate and exact snapshots without stock changes',
    async () => {
      const [first, second] = await Promise.all([run(command), run(command)]);
      assert.deepEqual(first, second);
      completed = first;
      assert.equal(first.status, 'completed');
      assert.equal(first.version, 1);
      assert.equal(first.currency, 'CLP');
      assert.equal(first.total_amount, '3000');
      assert.equal(first.payment_method, 'bank_transfer');
      assert.ok(first.completed_at);
      assert.equal(first.items[0].product_name_snapshot, 'Checkout paid');
      assert.equal(first.items[0].product_barcode_snapshot, '000017');
      assert.equal(first.items[0].unit_price, '1500');
      assert.equal(first.items[1].unit_price, '0');
      assert.deepEqual(await counts(), {
        sales: '1',
        items: '2',
        receipts: '1',
        events: '1',
      });
      assert.deepEqual(
        await db.query(
          'SELECT id::text,stock,has_stock,version FROM products WHERE business_id=$1 ORDER BY id',
          [business],
        ),
        productsBefore,
      );
      const [header] = await db.query(
        'SELECT created_by::text,updated_by::text,completed_by::text FROM sales WHERE id=$1',
        [first.id],
      );
      assert.deepEqual(header, {
        created_by: actor.userId,
        updated_by: actor.userId,
        completed_by: actor.userId,
      });
      const [event] = await db.query(
        'SELECT event_type,sale_version,origin,changes FROM sale_events WHERE sale_id=$1',
        [first.id],
      );
      assert.equal(event.event_type, 'checkout');
      assert.equal(event.sale_version, 1);
      assert.equal(event.origin, 'http');
      assert.equal(event.changes.from_status, null);
      assert.equal(event.changes.to_status, 'completed');
      const [receipt] = await db.query(
        'SELECT operation,result_status,result_version,result FROM sale_mutation_requests WHERE business_id=$1 AND request_key=$2',
        [business, command.request_key],
      );
      assert.equal(receipt.operation, 'checkout');
      assert.equal(receipt.result_status, 'completed');
      assert.equal(receipt.result_version, 1);
      assert.deepEqual(receipt.result, first);
    },
  );
  await check(
    'checkout receipt recovers original result and rejects changed or legacy intent under the same key',
    async () => {
      assert.deepEqual(
        (await read.receipt(business, command.request_key, actor)).sale,
        completed,
      );
      assert.deepEqual(await run(command), completed);
      await assert.rejects(
        () => run({ ...command, payment_method: 'cash' }),
        /request_conflict/,
      );
      await assert.rejects(
        () => mutate.execute(business, 'create', command, actor),
        /request_conflict/,
      );
      assert.deepEqual(await counts(), {
        sales: '1',
        items: '2',
        receipts: '1',
        events: '1',
      });
    },
  );
  await check(
    'checkout rejects empty, zero, foreign, unavailable and stale carts without any durable rows',
    async () => {
      for (const [items, pattern] of [
        [[], /invalid_command/],
        [[item(zero.id, '0')], /positive_total/],
        [[item('5', '100')], /unavailable/],
        [[item(unavailable.id, '100')], /unavailable/],
        [[item(unknown.id, '100')], /unavailable/],
        [[item(paid.id, '1499')], /product_changed/],
        [[item(paid.id, '1500', 2)], /product_changed/],
      ])
        await unchanged({ request_key: randomUUID(), items }, pattern);
    },
  );
  await check(
    'checkout event persistence failure rolls back header, items and receipt together',
    async () => {
      await db.query(`CREATE FUNCTION checkout_test_reject_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.business_id='${business}'::uuid AND NEW.event_type='checkout'
        THEN RAISE EXCEPTION 'synthetic_checkout_event_failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER checkout_test_reject_event BEFORE INSERT ON sale_events
        FOR EACH ROW EXECUTE FUNCTION checkout_test_reject_event();`);
      try {
        await unchanged(
          { request_key: randomUUID(), items: [item()] },
          /synthetic_checkout_event_failure/,
        );
      } finally {
        await db.query(
          'DROP TRIGGER checkout_test_reject_event ON sale_events; DROP FUNCTION checkout_test_reject_event();',
        );
      }
    },
  );
  await check(
    'uncommitted checkout absence stays unconfirmed and the exact identity recovers after commit',
    async () => {
      const runner = db.createQueryRunner();
      const intent = { request_key: randomUUID(), items: [item()] };
      await runner.connect();
      await runner.startTransaction();
      try {
        const sale = await run(intent, actor, runner.manager);
        assert.equal(sale.status, 'completed');
        assert.equal(sale.version, 1);
        assert.deepEqual(
          await read.receipt(business, intent.request_key, actor),
          { status: 'unconfirmed' },
        );
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::text AS n FROM sales WHERE id=$1',
              [sale.id],
            )
          )[0].n,
          '0',
        );
        await runner.commitTransaction();
        assert.deepEqual(
          (await read.receipt(business, intent.request_key, actor)).sale,
          sale,
        );
        assert.deepEqual(
          await run({ ...intent, payment_method: 'cash' }),
          sale,
        );
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  await check(
    'checkout revalidates business ownership and revoked module even for a committed receipt',
    async () => {
      const before = await counts();
      await assert.rejects(() => run(command, other), /resource_not_found/);
      await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
      try {
        await assert.rejects(() => run(command), /module_access_required/);
        await assert.rejects(
          () => run({ request_key: randomUUID(), items: [item()] }),
          /module_access_required/,
        );
      } finally {
        await db.query(
          'UPDATE user_modules SET is_active=true WHERE user_id=1',
        );
      }
      assert.deepEqual(await counts(), before);
    },
  );
  await check(
    'checkout HTTP validates required items and confirms directly while legacy create still returns draft',
    async () => {
      const url = `${httpBase}/businesses/${business}/sales`;
      const post = (suffix, body) =>
        fetch(url + suffix, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      for (const extra of [
        {},
        { items: [] },
        { items: [item()], completed_at: '2020-01-01T00:00:00Z' },
        { items: [item()], sale_id: randomUUID() },
      ]) {
        const before = await counts();
        assert.equal(
          (await post('/checkout', { request_key: randomUUID(), ...extra }))
            .status,
          400,
        );
        assert.deepEqual(await counts(), before);
      }
      const response = await post('/checkout', {
        request_key: randomUUID(),
        items: [item()],
        payment_method: 'debit_card',
      });
      assert.equal(response.status, 201);
      const sale = await response.json();
      assert.equal(sale.status, 'completed');
      assert.equal(sale.version, 1);
      assert.equal(sale.payment_method, 'debit_card');
      assert.equal(sale.total_amount, '1500');
      assert.ok(sale.completed_at);
      const legacy = await post('', { request_key: randomUUID() });
      assert.equal(legacy.status, 201);
      const draft = await legacy.json();
      assert.equal(draft.status, 'draft');
      await mutate.execute(
        business,
        'discard',
        {
          request_key: randomUUID(),
          sale_id: draft.id,
          expected_version: draft.version,
        },
        actor,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::text AS n FROM sales WHERE business_id=$1 AND status='draft'",
            [business],
          )
        )[0].n,
        '0',
      );
    },
  );
  await check(
    'checkout reports and public reads include the completed sale immediately with immutable snapshots',
    async () => {
      const [reference] = await db.query(
        "SELECT count(*)::text AS n,sum(total_amount)::text AS amount FROM sales WHERE business_id=$1 AND status='completed'",
        [business],
      );
      const summary = await read.summary(business, {}, actor);
      assert.equal(summary.sales_count, reference.n);
      assert.equal(summary.total_amount, reference.amount);
      const listing = await read.list(business, { status: 'completed' }, actor);
      assert.equal(String(listing.meta.total), reference.n);
      assert.deepEqual(
        await read.get(business, completed.id, actor),
        completed,
      );
      const migration = new AddDirectSaleCheckout1793420000000();
      await assert.rejects(
        () => db.transaction((tx) => migration.down(tx.queryRunner)),
        /checkout_rollback_would_lose_data/,
      );
      assert.deepEqual(
        await read.get(business, completed.id, actor),
        completed,
      );
    },
  );
  await check(
    'checkout waits for a concurrent product edit and rejects its stale observed price without a draft',
    async () => {
      const runner = db.createQueryRunner();
      const intent = { request_key: randomUUID(), items: [item()] };
      const before = await counts();
      await runner.connect();
      await runner.startTransaction();
      let pending;
      try {
        await runner.query(
          'UPDATE products SET sale_price=1600,version=2 WHERE id=$1',
          [paid.id],
        );
        pending = run(intent).then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 80; attempt++) {
          const [row] = await db.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM products p WHERE%') AS waiting",
          );
          if (row.waiting) {
            waiting = true;
            break;
          }
          await delay(10);
        }
        assert.equal(waiting, true);
        await runner.commitTransaction();
        assert.match((await pending).error?.message ?? '', /product_changed/);
        assert.deepEqual(await counts(), before);
        assert.deepEqual(
          await read.receipt(business, intent.request_key, actor),
          { status: 'unconfirmed' },
        );
        assert.deepEqual(
          await read.get(business, completed.id, actor),
          completed,
        );
        assert.equal(
          (
            await db.query('SELECT stock FROM products WHERE id=$1', [paid.id])
          )[0].stock,
          7,
        );
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await pending;
        await runner.release();
      }
    },
  );
}
