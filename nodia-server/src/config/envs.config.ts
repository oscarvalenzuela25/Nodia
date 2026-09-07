import 'dotenv/config';

export const configModuleEnvs = () => ({
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  POSTGRES_DB: process.env.POSTGRES_DB || 'template_db',
  POSTGRES_PORT: process.env.POSTGRES_PORT
    ? parseInt(process.env.POSTGRES_PORT)
    : 5432,
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_USER: process.env.POSTGRES_USER || 'template_user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'template_password',
});

export const envs = configModuleEnvs();
