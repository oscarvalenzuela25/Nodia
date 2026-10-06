import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { envs } from './envs.config.js';

export const postgresConfig: TypeOrmModuleOptions = {
  type: 'postgres' as const,
  host: envs.POSTGRES_HOST,
  port: envs.POSTGRES_PORT,
  database: envs.POSTGRES_DB,
  username: envs.POSTGRES_USER,
  password: envs.POSTGRES_PASSWORD,
  autoLoadEntities: true,
  // Entity registration must never implicitly alter an existing database.
  // Schema changes are applied through reviewed, explicit migrations.
  synchronize: false,
};
