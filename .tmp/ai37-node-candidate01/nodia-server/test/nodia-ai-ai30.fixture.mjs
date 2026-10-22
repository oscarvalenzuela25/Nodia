// Synthetic report records, created exclusively inside the disposable AI-30 database.
export async function seedAi30Reports(db) {
  const categories = [];
  for (const [owner, key] of [['1', 'food'], ['1', 'travel'], ['1', 'large'], ['2', 'food']]) {
    const [category] = await db.query(
      'INSERT INTO finance_categories(user_id,name,key) VALUES($1,$2,$3) RETURNING id::text',
      [owner, `AI30 ${key}`, `ai30_${key}`],
    );
    categories.push(category.id);
  }
  const groups = [];
  for (const key of ['first', 'second']) {
    const [group] = await db.query(
      'INSERT INTO finance_category_groups(user_id,name,key) VALUES(1,$1,$2) RETURNING id::text',
      [`AI30 ${key}`, `ai30_${key}`],
    );
    groups.push(group.id);
    await db.query(
      'INSERT INTO finance_category_group_memberships(user_id,category_group_id,category_id) VALUES(1,$1,$2)',
      [group.id, categories[0]],
    );
  }
  const movements = [];
  const rows = [
    ['1', categories[0], '100', 'paid', '2027-01-01T03:00:00Z'],
    ['1', categories[0], '100', 'paid', '2027-02-01T02:59:59Z'],
    ['1', categories[1], '40', 'paid', '2027-01-15T12:00:00Z'],
    ['1', categories[0], '25', 'pending', '2027-01-20T12:00:00Z'],
    ['1', categories[0], '9', 'paid', '2027-01-01T02:59:59Z'],
    ['1', categories[0], '11', 'paid', '2027-02-01T03:00:00Z'],
    ['1', categories[2], '9007199254740993', 'paid', '2027-02-15T12:00:00Z'],
    ['2', categories[3], '700', 'paid', '2027-01-10T12:00:00Z'],
  ];
  for (const [owner, category, amount, status, created] of rows) {
    const [movement] = await db.query(
      "INSERT INTO finance_movements(user_id,category_id,name,amount,type,status,created_at) VALUES($1,$2,'AI30 synthetic expense',$3,'expense',$4,$5) RETURNING id::text",
      [owner, category, amount, status, created],
    );
    movements.push(movement.id);
  }
  const properties = [];
  for (const [owner, name] of [['1', 'owned'], ['2', 'shared'], ['2', 'hidden']]) {
    const [property] = await db.query(
      "INSERT INTO rental_properties(owner_id,name,timezone,max_guests,minimum_turnover_minutes,created_by,updated_by) VALUES($1,$2,'America/Santiago',4,0,$1,$1) RETURNING id::text",
      [owner, `AI30 ${name}`],
    );
    properties.push(property.id);
  }
  await db.query(
    'INSERT INTO rental_collaborators(property_id,user_id,created_by,updated_by) VALUES($1,1,2,2)',
    [properties[1]],
  );
  const expenses = [];
  for (const [property, owner, amount, category, status] of [
    [properties[0], '1', '100', 'cleaning', 'paid'],
    [properties[1], '2', '200', null, 'pending'],
    [properties[2], '2', '900', 'cleaning', 'paid'],
  ]) {
    const [expense] = await db.query(
      "INSERT INTO rental_expenses(property_id,name,category,amount,incurred_on,paid_on,status,created_by,updated_by) VALUES($1,'AI30 synthetic rental expense',$2,$3,'2027-01-15',CASE WHEN $4='paid' THEN DATE '2027-01-16' ELSE NULL END,$4,$5,$5) RETURNING id::text",
      [property, category, amount, status, owner],
    );
    expenses.push(expense.id);
  }
  const [business] = await db.query(
    "INSERT INTO businesses(name,owner_id) VALUES('AI30 unrelated business',2) RETURNING id::text",
  );
  const [supplier] = await db.query(
    "INSERT INTO providers(business_id,name,tax,fields) VALUES($1,'AI30 supplier',0,'{}') RETURNING id::text",
    [business.id],
  );
  for (const [id, stock] of [['9007199254740993', 7], ['9007199254740994', 7], ['9007199254740995', 0]]) {
    await db.query(
      "INSERT INTO products(id,business_id,provider_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) VALUES($1,$2,$3,$4,'AI30 product',100,119,20,140,$5)",
      [id, business.id, supplier.id, `AI30-${id}`, stock],
    );
    for (let index = 0; index < 2; index++) await db.query(
      "INSERT INTO product_logs(product_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) VALUES($1,$2,'AI30 duplicate snapshot',100,119,20,140,$3)",
      [id, `AI30-${id}`, stock],
    );
  }
  for (const [code, amount] of [['AI30-equal-a', 100], ['AI30-equal-b', 100], ['AI30-zero', 0]])
    await db.query(
      "INSERT INTO invoices(business_id,provider_id,code,total_amount,data,created_at) VALUES($1,$2,$3,$4,'{}','2027-01-15T12:00:00')",
      [business.id, supplier.id, code, amount],
    );
  return { categories, groups, movements, properties, expenses, business: business.id, supplier: supplier.id };
}
