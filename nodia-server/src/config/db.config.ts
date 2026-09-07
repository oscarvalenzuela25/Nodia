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
  synchronize: true,
};
