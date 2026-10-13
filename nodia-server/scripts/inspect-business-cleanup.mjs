import 'dotenv/config';
import pg from 'pg';
const db = new pg.Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
try {
  await db.connect();
  const tables = ['products', 'product_logs', 'invoices', 'invoice_uploads', 'providers', 'personal_info_provider'];
  for (const table of tables) {
    const exists = await db.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
    if (exists.rows[0].name) console.log(table, (await db.query(`SELECT count(*)::int AS count FROM public.${table}`)).rows[0].count);
  }
  console.log('Foreign keys', (await db.query(`SELECT conrelid::regclass::text AS source, confrelid::regclass::text AS target, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='f' AND confrelid IN ('products'::regclass,'invoices'::regclass)`)).rows);
  console.log('Uploads', (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='invoice_uploads'`)).rows);
} finally { await db.end(); }
