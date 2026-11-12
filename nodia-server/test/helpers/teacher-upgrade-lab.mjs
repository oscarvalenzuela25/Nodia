import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { CheckModuleAccessUseCase } from '../../dist/authorization/use-case/check-module-access.use-case.js';
import { TeacherService } from '../../dist/teacher/teacher.service.js';

/** Disposable PostgreSQL. Never imports application envs, profiles or credentials. */
export async function teacherUpgradeLab() {
  const name = `template_teacher_upgrade_${process.pid}_${randomBytes(4).toString('hex')}`;
  const docker = (...args) => execFileSync('docker', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const password = randomBytes(24).toString('hex');
  let started = false;
  let db;
  const close = async () => {
    if (db?.isInitialized) await db.destroy();
    if (started) { docker('rm', '--force', name); started = false; }
  };
  try {
    docker('run', '--pull=never', '--detach', '--rm', '--name', name,
      '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB=teacher_upgrade',
      '--env', 'POSTGRES_USER=teacher_upgrade', '--env', `POSTGRES_PASSWORD=${password}`,
      'postgres:16-alpine');
    started = true;
    for (let i = 0; i < 60; i++) {
      try { docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'teacher_upgrade'); break; }
      catch (error) { if (i === 59) throw error; await delay(200); }
    }
    const port = Number(docker('port', name, '5432/tcp').split(':').at(-1));
    db = new DataSource({ type: 'postgres', host: '127.0.0.1', port,
      username: 'teacher_upgrade', password, database: 'teacher_upgrade', synchronize: false });
    await db.initialize();
    await db.query(`
      CREATE TABLE users(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
      CREATE TABLE auth_sessions(public_id uuid PRIMARY KEY,user_id bigint NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL);
      CREATE TABLE roles(id bigint PRIMARY KEY,key text NOT NULL,is_active boolean NOT NULL DEFAULT true);
      CREATE TABLE user_roles(user_id bigint NOT NULL,role_id bigint NOT NULL,is_active boolean NOT NULL DEFAULT true);
      CREATE TABLE actions(id bigint PRIMARY KEY); CREATE TABLE role_actions(id bigint PRIMARY KEY);
      CREATE TABLE module_groups(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true,name text);
      CREATE TABLE modules(id bigint PRIMARY KEY,key text,link text,module_group_id bigint,is_active boolean NOT NULL DEFAULT true);
      CREATE TABLE user_modules(user_id bigint,module_id bigint,is_active boolean NOT NULL DEFAULT true);
      INSERT INTO users(id) VALUES(1),(2),(3);
      INSERT INTO module_groups(id,name) VALUES(1,'Synthetic QA');
      INSERT INTO modules(id,key,link,module_group_id) VALUES(1,'nodia_teacher','/nodia-teacher',1);
      INSERT INTO user_modules(user_id,module_id) VALUES(1,1),(2,1);`);
    const actor = { userId: '1', sessionId: randomUUID() };
    const other = { userId: '2', sessionId: randomUUID() };
    const noModule = { userId: '3', sessionId: randomUUID() };
    for (const a of [actor, other, noModule]) await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')",
      [a.sessionId, a.userId]);
    const migrate = async (file, direction = 'up') => {
      const module = await import(`../../dist/migrations/${file}.js`);
      const Migration = Object.values(module).find(value => typeof value === 'function');
      if (!Migration) throw new Error('migration_export_missing');
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try { await new Migration()[direction](runner); await runner.commitTransaction(); }
      catch (error) { await runner.rollbackTransaction(); throw error; }
      finally { await runner.release(); }
    };
    await migrate('1793570000000-CreateTeacherDomain');
    await migrate('1793590000000-PreserveTeacherArchivedPauseState');
    await migrate('1793610000000-PersistTeacherSetupDraft');
    // Read-side fixture only. Actual shared-runtime lifecycle has its own integration suite.
    await db.query(`CREATE TABLE ai_generation_operations(
      id uuid PRIMARY KEY,teacher_job_id uuid,phase text,remote_outcome text,terminal_proof jsonb,
      acknowledged_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp());`);
    const store = new TeacherService(db, new CheckModuleAccessUseCase(db));
    const generation = {
      setPublisher() {},
      async connections() { return { items: [], next_cursor: null }; },
      async eligibility() { return { eligible: false, reason_code: 'synthetic_transport_only' }; },
      async verifySelection() { return { configuration_generation: 'synthetic-generation', session_generation: null }; },
    };
    const backupRestore = async () => {
      const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
        .map(row => row.tablename);
      if (tables.some(table => !/^[a-z_][a-z0-9_]*$/.test(table))) throw new Error('unsafe_lab_table');
      const fingerprint = async source => {
        const contents = [];
        for (const table of tables) contents.push([table, await source.query(
          `SELECT to_jsonb(t) AS data FROM "${table}" t ORDER BY to_jsonb(t)::text`)]);
        return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
      };
      const before = await fingerprint(db);
      // Both databases live only in this disposable container; no app worker runs here.
      docker('exec', name, 'pg_dump', '-U', 'teacher_upgrade', '-d', 'teacher_upgrade',
        '--format=custom', '--file=/tmp/teacher-upgrade.dump');
      docker('exec', name, 'createdb', '-U', 'teacher_upgrade', 'teacher_restore');
      docker('exec', name, 'pg_restore', '-U', 'teacher_upgrade', '-d', 'teacher_restore',
        '--exit-on-error', '/tmp/teacher-upgrade.dump');
      const restored = new DataSource({ ...db.options, database: 'teacher_restore' });
      try {
        await restored.initialize();
        const after = await fingerprint(restored);
        if (before !== after) throw new Error('lab_restore_content_mismatch');
        return { tables: tables.length, before, after };
      } finally { if (restored.isInitialized) await restored.destroy(); }
    };
    return { db, store, generation, actor, other, noModule, migrate, close, backupRestore };
  } catch (error) { await close(); throw error; }
}
