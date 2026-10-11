import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuredDataSource from '../dist/config/data-source.js';
import { CreateInvoiceUploads1791630000000 } from '../dist/migrations/1791630000000-CreateInvoiceUploads.js';

// Apply only the recovery journal; never implicitly run unrelated migrations.
const source = new DataSource({
  ...configuredDataSource.options,
  migrations: [CreateInvoiceUploads1791630000000],
});
if (
  process.argv.includes('--local-only') &&
  !['localhost', '127.0.0.1', '::1'].includes(source.options.host)
) {
  throw new Error(
    'Local-only migration refused: configured database is not on loopback.',
  );
}
try {
  await source.initialize();
  const runner = source.createQueryRunner();
  try {
    const invoice = await runner.getTable('invoices');
    if (
      !invoice?.columns.some(
        (column) =>
          column.name === 'path_storage' &&
          ['varchar', 'character varying'].includes(column.type),
      )
    ) {
      throw new Error(
        'Invoice upload recovery requires the existing invoices storage-path schema.',
      );
    }
  } finally {
    await runner.release();
  }
  const applied = await source.runMigrations({ transaction: 'all' });
  console.log(
    applied.length
      ? 'Invoice upload recovery migration applied.'
      : 'Invoice upload recovery migration already applied.',
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
