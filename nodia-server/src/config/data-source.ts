import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { envs } from './envs.config.js';

// Compiled CLI data source. Run migrations against an existing Nodia schema.
export default new DataSource({
  type: 'postgres',
  host: envs.POSTGRES_HOST,
  port: envs.POSTGRES_PORT,
  database: envs.POSTGRES_DB,
  username: envs.POSTGRES_USER,
  password: envs.POSTGRES_PASSWORD,
  entities: [fileURLToPath(new URL('../**/*.entity.js', import.meta.url))],
  migrations: [fileURLToPath(new URL('../migrations/*.js', import.meta.url))],
  synchronize: false,
});
