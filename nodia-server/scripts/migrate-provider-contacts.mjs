import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuredDataSource from '../dist/config/data-source.js';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';

// Explicit operational command. Limit this run to contacts, preserving unrelated migrations.
const source = new DataSource({
  ...configuredDataSource.options,
  migrations: [CreateProviderContacts1791220000000],
});
try {
  await source.initialize();
  const runner = source.createQueryRunner();
  try {
    const provider = await runner.getTable('providers');
    const id = provider?.columns.find((column) => column.name === 'id');
    if (!id?.isPrimary || id.type !== 'bigint') {
      throw new Error(
        'Provider contacts requires an existing providers table with a bigint primary key. Review the database baseline first.',
      );
    }
  } finally {
    await runner.release();
  }
  const applied = await source.runMigrations({ transaction: 'all' });
  console.log(
    applied.length
      ? 'Provider contacts migration applied.'
      : 'Provider contacts migration already applied.',
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
