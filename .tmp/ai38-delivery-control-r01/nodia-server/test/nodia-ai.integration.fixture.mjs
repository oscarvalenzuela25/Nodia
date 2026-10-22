// Shared disposable PostgreSQL fixture. It never reads the configured database or provider credentials.
import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
export const loadAi = async (file, name) =>
  (await import('../dist/' + file + '.js'))[name];
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
export async function createNodiaAiIntegrationFixture(stage = 'ai10') {
  if (!/^ai[0-9]+$/.test(stage)) throw new Error('Invalid test stage');
  const container = `template_${stage}_${process.pid}_${randomBytes(4).toString('hex')}`;
  const password = randomBytes(20).toString('hex');
  let started = false,
    db;
  const close = async () => {
    try {
      if (db?.isInitialized) await db.destroy();
    } finally {
      if (started) {
        docker('rm', '-f', container);
        started = false;
      }
    }
  };
  try {
    docker(
      'run',
      '-d',
      '--rm',
      '--name',
      container,
      '-p',
      '127.0.0.1::5432',
      '-e',
      `POSTGRES_USER=${stage}`,
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      '-e',
      `POSTGRES_DB=${stage}`,
      'postgres:16-alpine',
    );
    started = true;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', stage);
        break;
      } catch (error) {
        if (attempt === 79) throw error;
        await delay(250);
      }
    }
    const options = {
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
      username: stage,
      password,
      database: stage,
      synchronize: false,
      entities: [
        fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
      ],
      migrations: [
        fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
      ],
    };
    db = await new DataSource(options).initialize();
    await db.runMigrations();
    const identities = new Map(
      ['1', '2', '3'].map((userId) => [
        userId,
        { userId, sessionId: randomUUID() },
      ]),
    );
    for (const [id, identity] of identities) {
      await db.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)', [
        id,
        `synthetic${id}@example.invalid`,
        'Synthetic ' + id,
      ]);
      await db.query(
        "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'synthetic',now()+interval '1 hour')",
        [identity.sessionId, id],
      );
    }
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT 3,id FROM roles WHERE key='super_admin'",
    );
    await db.query(
      "INSERT INTO user_modules(user_id,module_id) SELECT u.id,m.id FROM users u CROSS JOIN modules m WHERE m.key='nodia_ai'",
    );
    return { db, options, identities, close };
  } catch (error) {
    await close();
    throw error;
  }
}
