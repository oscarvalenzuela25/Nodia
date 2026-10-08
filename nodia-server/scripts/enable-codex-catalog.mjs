import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuredDataSource from '../dist/config/data-source.js';
import { EnableCodexAgenticCatalog1791450000000 } from '../dist/migrations/1791450000000-EnableCodexAgenticCatalog.js';

// Explicit target migration only. No runtime/login/inference or instance updates.
const source = new DataSource({
  ...configuredDataSource.options,
  migrations: [EnableCodexAgenticCatalog1791450000000],
});
try {
  await source.initialize();
  const rows = await source.query(
    "SELECT id FROM ai_provider_catalog WHERE key = 'openai'",
  );
  if (rows.length !== 1)
    throw new Error('An existing unique OpenAI catalog row is required.');
  if (process.argv.includes('--rollback')) {
    const [last] = await source.query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1',
    );
    if (last?.name !== 'EnableCodexAgenticCatalog1791450000000')
      throw new Error(
        'Codex must be the last applied migration to use this rollback command.',
      );
    await source.undoLastMigration({ transaction: 'all' });
  } else await source.runMigrations({ transaction: 'all' });
  console.log(
    await source.query(
      "SELECT id, key, can_use_api_key, can_use_token_plan_web, can_use_token_plan_agentic FROM ai_provider_catalog WHERE key = 'openai'",
    ),
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
