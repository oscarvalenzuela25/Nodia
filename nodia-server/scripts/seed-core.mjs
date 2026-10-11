import 'reflect-metadata';
import dataSource from '../dist/config/data-source.js';
import { SeedAuthUseCase } from '../dist/auth/use-case/seed-auth.use-case.js';
import { TranslationService } from '../dist/translation/translation.service.js';
import { Translation } from '../dist/translation/entities/translation.entity.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { isEmail } from 'class-validator';
import { envs } from '../dist/config/envs.config.js';

// Explicit installation operation, never an automatic startup hook.
const redis = new RedisService();
try {
  if (!isEmail(envs.BOOTSTRAP_SUPER_ADMIN_EMAIL.trim())) {
    throw new Error(
      'Configure a valid BOOTSTRAP_SUPER_ADMIN_EMAIL before running Core setup.',
    );
  }
  await dataSource.initialize();
  if (process.argv.includes('--migrate')) {
    const [{ count }] = await dataSource.query(`SELECT count(*)::int AS count
      FROM pg_tables WHERE schemaname=current_schema() AND tablename <> 'migrations'`);
    if (count > 0 && (await dataSource.showMigrations())) {
      throw new Error(
        'db:setup is for empty installations or a fully migrated repeat. Reconcile existing migration history before updating an existing database.',
      );
    }
    await dataSource.runMigrations();
  }
  redis.onModuleInit();
  await new SeedAuthUseCase(
    dataSource,
    new TranslationService(dataSource.getRepository(Translation)),
    redis,
  ).bootstrap();
  console.log(
    'Core administrator and its four module assignments initialized or already verified.',
  );
} finally {
  await redis.onModuleDestroy();
  if (dataSource.isInitialized) await dataSource.destroy();
}
