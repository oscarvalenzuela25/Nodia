// Companion only: the caller owns an explicitly disposable PostgreSQL fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Product } from '../dist/product/entities/product.entity.js';
import { ProductLog } from '../dist/product/entities/product-log.entity.js';
import { ProductService } from '../dist/product/product.service.js';
import { GetAllProductsUseCase } from '../dist/product/use-case/get-all-products.use-case.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';

export async function verifyProductUnitComparisons({ db, actor, check }) {
  const businessId = randomUUID();
  await db.query('INSERT INTO businesses(id,name,owner_id) VALUES($1,$2,$3)', [businessId, 'Synthetic product-unit comparisons', actor.userId]);
  const products = new ProductService(db.getRepository(Product), db.getRepository(ProductLog), new CheckModuleAccessUseCase(db));
  const reader = new GetAllProductsUseCase(products);
  const create = (name, sale_price, measurement_unit = 'unit', code = null) => products.createProduct({
    business_id: businessId, code, name, measurement_unit,
    cost_price: 0, cost_price_tax: 0, profit_percentage: 0, sale_price, has_stock: true,
  }, undefined, actor);
  let same, changed, fresh;

  await check('nullable product codes coexist without fabricating identity while non-null codes remain unique', async () => {
    same = await create('Synthetic unit baseline', 100);
    changed = await create('Synthetic measurement transition', 90, 'kg');
    fresh = await create('Synthetic no previous baseline', 200);
    assert.ok(same.id !== changed.id && changed.id !== fresh.id);
    assert.equal(same.code, null);
    assert.equal(changed.code, null);
    assert.equal(fresh.code, null);
    await create('Synthetic coded product', 10, 'unit', 'fixture-code');
    await assert.rejects(() => create('Synthetic duplicate code', 20, 'kg', 'fixture-code'), /product:code_conflict/);
    const [{ products: count, logs }] = await db.query(`SELECT
      (SELECT count(*)::int FROM products WHERE business_id=$1) AS products,
      (SELECT count(*)::int FROM product_logs l JOIN products p ON p.id=l.product_id WHERE p.business_id=$1) AS logs`, [businessId]);
    assert.equal(count, 4);
    assert.equal(logs, 4);
  });

  await check('price filters select the latest real snapshot before checking measurement compatibility', async () => {
    await products.updateProduct(same.id, { sale_price: 150, expected_version: same.version }, undefined, actor);
    const middle = await products.updateProduct(changed.id, { sale_price: 200, measurement_unit: 'g', expected_version: changed.version }, undefined, actor);
    await products.updateProduct(changed.id, { sale_price: 150, measurement_unit: 'kg', expected_version: middle.version }, undefined, actor);
    const list = async (price_change_in) => reader.execute({ all: true, includes: false,
      q: { business_id_eq: businessId, price_change_in } }, actor);
    const increased = await list(['increased']);
    assert.ok(increased.data.some((product) => product.id === same.id));
    assert.ok(!increased.data.some((product) => product.id === changed.id));
    for (const variation of ['increased', 'decreased', 'unchanged']) {
      const result = await list([variation]);
      assert.ok(!result.data.some((product) => product.id === changed.id));
    }
    const unchanged = await list(['unchanged']);
    assert.ok(unchanged.data.some((product) => product.id === fresh.id));
    const current = await products.findOneProduct(changed.id, actor);
    assert.equal(current.measurement_unit, 'kg');
    assert.equal(current.previous_price_snapshot.measurement_unit, 'g');
    assert.equal(current.previous_price_snapshot.sale_price, 200);
  });
}
