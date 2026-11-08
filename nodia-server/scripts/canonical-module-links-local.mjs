import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import ts from 'typescript';
import dotenv from 'dotenv';

// A targeted local operation: never executes the pending migration catalogue or a seed.
const root = new URL('../../', import.meta.url);
const artifacts = new URL('ops/lab/artifacts/canonical-module-links-20261101-r01/', root);
const temporary = new URL('../.tmp/canonical-module-links/', import.meta.url);
const config = dotenv.parse(await readFile(new URL('nodia-server/.env', root)));
assert.ok(['localhost', '127.0.0.1', '::1'].includes(config.POSTGRES_HOST), 'local_database_required');
assert.equal(Number(config.POSTGRES_PORT), 5432, 'established_local_docker_port_required');
const options = { type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  database: config.POSTGRES_DB, username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  synchronize: false, logging: false };
await mkdir(artifacts, { recursive: true });
await mkdir(temporary, { recursive: true });
const name = 'CanonicalModuleLinks1793560000000';
const migrationPath = new URL('../src/migrations/1793560000000-CanonicalModuleLinks.ts', import.meta.url);
const sourceText = await readFile(migrationPath, 'utf8');
const migrationHash = createHash('sha256').update(sourceText).digest('hex');
const compiled = ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { CanonicalModuleLinks1793560000000: Migration } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const routeModule = await readFile(new URL('../src/authorization/canonical-module-route.ts', import.meta.url), 'utf8');
const routeCompiled = ts.transpileModule(routeModule, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
await writeFile(new URL('canonical-module-route.js', temporary), routeCompiled);
const { MODULE_ROUTE_MIGRATION: mapping } = await import(pathToFileURL(fileURLToPath(new URL('canonical-module-route.js', temporary))).href);
await mkdir(new URL('use-case/', temporary), { recursive: true });
const accessText = await readFile(new URL('../src/authorization/use-case/check-module-access.use-case.ts', import.meta.url), 'utf8');
await writeFile(new URL('use-case/check-module-access.use-case.js', temporary), ts.transpileModule(accessText, { compilerOptions: {
  module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
} }).outputText);
const { CheckModuleAccessUseCase } = await import(pathToFileURL(fileURLToPath(new URL('use-case/check-module-access.use-case.js', temporary))).href);
const quote = value => `"${value.replaceAll('"', '""')}"`;
const save = (file, value) => writeFile(new URL(file, artifacts), `${JSON.stringify(value, null, 2)}\n`);
const runSnapshot = (...args) => JSON.parse(execFileSync('python', [fileURLToPath(new URL('database_snapshot.py', artifacts)), ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 }));
async function fingerprint(manager, omit = [], legacySlotProjection = false, legacyArchiveProjection = false) {
  const tables = (await manager.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).map(row => row.tablename);
  const result = {};
  for (const table of tables.filter(table => !omit.includes(table))) {
    const value = legacySlotProjection && table === 'nodia_ai_runtime_slots' ? "(to_jsonb(t)-'generation_operation_id')"
      : legacyArchiveProjection && table === 'teacher_sessions' ? "(to_jsonb(t)-'archived_state')" : 'to_jsonb(t)';
    const [row] = await manager.query(`SELECT count(*)::text AS count, encode(sha256(convert_to(coalesce(string_agg(
      encode(sha256(convert_to(${value}::text,'UTF8')),'hex'),'' ORDER BY ${value}::text),''),'UTF8')),'hex') AS hash FROM ${quote(table)} t`);
    result[table] = row;
  }
  return result;
}
async function modules(manager) {
  return manager.query('SELECT id::text,key,link,module_group_id::text,is_active,sort_order,created_at,updated_at FROM modules ORDER BY id');
}
async function inventory(source) {
  return source.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    const columns = await manager.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
      AND data_type IN ('text','character varying','json','jsonb') ORDER BY table_name,column_name`);
    const references = [];
    for (const column of columns) {
      const [row] = await manager.query(`SELECT count(*)::int AS count FROM ${quote(column.table_name)} WHERE ${quote(column.column_name)}::text LIKE ANY($1::text[])`, [mapping.map(([from]) => `%${from}%`)]);
      if (row.count > 0) references.push({ ...column, count: row.count });
    }
    return { environment: { host: options.host, port: options.port, database: options.database, container: 'nodia_postgres', scope: 'local_working_database_only' },
      migration: name, migration_sha256: migrationHash, mapping, modules: await modules(manager),
      historical_route_references: references, table_fingerprints: await fingerprint(manager),
      applied: await manager.query('SELECT name FROM migrations ORDER BY timestamp,name') };
  });
}
async function migrate(source, direction) {
  return source.transaction('REPEATABLE READ', async manager => {
    await new Migration()[direction](manager.queryRunner);
  });
}
async function loadMigration(filename, exportName) {
  const body = await readFile(new URL(`../src/migrations/${filename}`, import.meta.url), 'utf8');
  const emitted = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(emitted).toString('base64')}`);
  return { Migration: module[exportName], sha256: createHash('sha256').update(body).digest('hex') };
}
async function schemaFingerprint(manager) {
  const columns = await manager.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  const constraints = await manager.query(`SELECT c.conrelid::regclass::text AS relation,c.conname,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY relation,c.conname`);
  const indexes = await manager.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  return createHash('sha256').update(JSON.stringify({ columns, constraints, indexes })).digest('hex');
}
async function runtimeInventory(manager) {
  const [row] = await manager.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots,
    (SELECT count(*)::int FROM nodia_ai_api_dispatches WHERE state='running') AS open_api_dispatches,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE phase='dispatch_armed' AND ended_at IS NULL) AS armed_attempts,
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state='leased') AS leased_jobs`);
  const [teacher] = await manager.query("SELECT to_regclass('teacher_generation_jobs') IS NOT NULL AS present");
  if (teacher.present) {
    const [extra] = await manager.query(`SELECT
      (SELECT count(*)::int FROM teacher_generation_jobs WHERE state='running') AS running_teacher_jobs,
      (SELECT count(*)::int FROM ai_generation_operations WHERE phase<>'closed') AS open_generation_operations`);
    Object.assign(row, extra);
  }
  return row;
}
async function verifyAuthority(source) {
  const runner = source.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  try {
    const manager = runner.manager;
    const access = new CheckModuleAccessUseCase(source);
    const [user] = await manager.query("INSERT INTO users(email,name,is_active) VALUES('route-authority-synthetic@example.invalid','Synthetic route authority',true) RETURNING id::text");
    const [module] = await manager.query("SELECT id::text,module_group_id::text FROM modules WHERE link IN ('/tools/business','/business') ORDER BY id LIMIT 1");
    assert.ok(module, 'business module fixture required from restored baseline');
    await manager.query('INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)', [user.id, module.id]);
    await access.execute(user.id, ['/business'], manager);
    await access.execute(user.id, ['/tools/business'], manager);
    await assert.rejects(access.execute(user.id, ['/users'], manager), /core:module_access_required/);
    await manager.query("UPDATE module_groups SET key='synthetic-renamed-presentation-group' WHERE id=$1", [module.module_group_id]);
    await access.execute(user.id, ['/business'], manager);
    const [group] = await manager.query("INSERT INTO module_groups(key,sort_order,is_active) SELECT 'synthetic-moved-presentation-group',coalesce(max(sort_order),0)+1,true FROM module_groups RETURNING id::text");
    await manager.query('UPDATE modules SET module_group_id=$1,sort_order=0 WHERE id=$2', [group.id, module.id]);
    await access.execute(user.id, ['/business'], manager);
    await manager.query('UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2', [user.id, module.id]);
    await assert.rejects(access.execute(user.id, ['/business'], manager), /core:module_access_required/);
    const duplicates = await manager.query("SELECT id::text FROM modules WHERE link IN ('/tools/nodia-ai','/nodia-ai')");
    if (duplicates.length > 1) {
      for (const duplicate of duplicates) await manager.query('INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)', [user.id, duplicate.id]);
      await assert.rejects(access.execute(user.id, ['/nodia-ai'], manager), /core:module_access_required/);
    }
  } finally {
    await runner.rollbackTransaction(); await runner.release();
  }
}
const source = new DataSource(options);
let disposable;
let disposableCreated = false;
let copy;
try {
  await source.initialize();
  const mode = process.argv[2] ?? 'inventory';
  if (mode === 'provider-inventory') {
    const report = await source.transaction(async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [providers] = await manager.query(`SELECT count(*)::int AS total, count(*) FILTER(WHERE is_active)::int AS active,
        count(*) FILTER(WHERE is_active AND use_api_key)::int AS active_api_enabled,
        count(*) FILTER(WHERE is_active AND use_agentic)::int AS active_agentic_enabled,
        count(*) FILTER(WHERE is_active AND use_api_key AND nullif(btrim(fields#>>'{api_key,selected_model}'),'') IS NOT NULL)::int AS api_with_exact_configured_model,
        count(*) FILTER(WHERE is_active AND use_api_key AND nullif(btrim(fields#>>'{api_key,selected_model}'),'') IS NOT NULL AND EXISTS(
          SELECT 1 FROM ai_api_keys k WHERE k.provider_id=ai_providers.id AND k.is_active AND k.is_selected))::int AS api_with_model_and_selected_active_key FROM ai_providers`);
      const [keys] = await manager.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE is_active)::int AS active,
        count(*) FILTER(WHERE is_active AND is_selected)::int AS selected_active FROM ai_api_keys`);
      return { providers, keys, source: 'read_only_local_database', inference_verified: false, credentials_exported: false };
    });
    await save('provider-inventory.json', report); console.log(JSON.stringify(report));
  } else if (mode === 'inventory') {
    const report = await inventory(source);
    await save('inventory.json', report);
    console.log(JSON.stringify({ ok: true, mode, environment: report.environment, modules: report.modules, references: report.historical_route_references, tables: Object.keys(report.table_fingerprints).length }));
  } else if (mode === 'teacher-seed-rehearse') {
    const temporaryFiles = new Map([
      ['teacher/teacher-navigation.service.ts', 'teacher-navigation.service.js'],
      ['teacher/use-case/seed-teacher-navigation.use-case.ts', 'seed-teacher-navigation.use-case.js'],
    ]);
    for (const [relative, output] of temporaryFiles) {
      const sourceFile = new URL(`../src/${relative}`, import.meta.url);
      const body = await readFile(sourceFile, 'utf8');
      let emitted = ts.transpileModule(body, { compilerOptions: {
        module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
      } }).outputText;
      emitted = emitted.replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, specifier) => {
        const resolved = new URL(specifier, sourceFile);
        const location = resolved.href.endsWith('/teacher/teacher-navigation.service.js')
          ? new URL('teacher-navigation.service.js', temporary) : new URL(resolved.href.replace('/src/', '/dist/'));
        return `from '${location.href}'`;
      });
      await writeFile(new URL(output, temporary), emitted);
    }
    const { TeacherNavigationService } = await import(pathToFileURL(fileURLToPath(new URL('teacher-navigation.service.js', temporary))).href);
    const { SeedTeacherNavigationUseCase } = await import(pathToFileURL(fileURLToPath(new URL('seed-teacher-navigation.use-case.js', temporary))).href);
    runSnapshot('verify-before'); disposable = `nodia_routes_20261101_${Date.now()}`;
    await source.query(`CREATE DATABASE ${quote(disposable)}`); disposableCreated = true; runSnapshot('restore', disposable);
    copy = await new DataSource({ ...options, database: disposable }).initialize();
    const original = await fingerprint(copy);
    const seed = new SeedTeacherNavigationUseCase(copy, new TeacherNavigationService());
    await copy.query(`CREATE FUNCTION synthetic_reject_teacher_translation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.source_entity='modules' AND NEW.locale='en' THEN RAISE EXCEPTION 'synthetic_translation_failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_reject_teacher_translation BEFORE INSERT ON translations FOR EACH ROW EXECUTE FUNCTION synthetic_reject_teacher_translation()`);
    await assert.rejects(seed.execute(), /synthetic_translation_failure/);
    assert.deepEqual(await fingerprint(copy), original, 'translation failure rolls back the new group and module');
    await copy.query('DROP TRIGGER synthetic_reject_teacher_translation ON translations; DROP FUNCTION synthetic_reject_teacher_translation()');
    const first = await seed.execute(); assert.equal(first.created, true);
    assert.deepEqual(await copy.query("SELECT locale,value FROM translations WHERE source_entity='modules' AND source_id=$1 ORDER BY locale", [first.module_id]),
      [{ locale: 'en', value: 'Nodia Teacher' }, { locale: 'es', value: 'Nodia Teacher' }]);
    const created = await fingerprint(copy);
    for (const table of ['users', 'roles', 'user_modules', 'user_roles', 'role_actions']) assert.deepEqual(created[table], original[table], `registration never grants ${table}`);
    const repeated = await seed.execute(); assert.equal(repeated.created, false);
    assert.equal(repeated.module_id, first.module_id); assert.deepEqual(await fingerprint(copy), created, 'seed repetition preserves all rows');
    const [moved] = await copy.query("INSERT INTO module_groups(key,is_active,sort_order) SELECT 'synthetic-custom-menu',true,max(sort_order)+1 FROM module_groups RETURNING id::text");
    await copy.query("UPDATE module_groups SET key='synthetic-renamed-studies' WHERE id=$1", [first.group_id]);
    await copy.query('UPDATE modules SET module_group_id=$1,sort_order=0,is_active=false WHERE id=$2', [moved.id, first.module_id]);
    const movedRows = await fingerprint(copy);
    assert.deepEqual(await seed.execute(), { ...first, group_id: moved.id, created: false });
    assert.deepEqual(await fingerprint(copy), movedRows, 'seed preserves moved/inactive module and renamed group');
    await copy.query("UPDATE modules SET key='synthetic-user-maintained-teacher' WHERE id=$1", [first.module_id]);
    const customRows = await fingerprint(copy);
    const reused = await seed.execute(); assert.equal(reused.module_id, first.module_id); assert.equal(reused.module_key, 'synthetic-user-maintained-teacher');
    assert.deepEqual(await fingerprint(copy), customRows, 'reuse by exact route preserves custom module key');
    await copy.query(`INSERT INTO modules(key,link,module_group_id,is_active,sort_order)
      SELECT 'nodia_teacher','/nodia-teacher',module_group_id,true,1 FROM modules WHERE id=$1`, [first.module_id]);
    const ambiguous = await fingerprint(copy);
    await assert.rejects(seed.execute(), /teacher:navigation_ambiguous/);
    assert.deepEqual(await fingerprint(copy), ambiguous, 'ambiguous registration never merges module IDs');
    const report = { ok: true, scope: 'disposable_restored_database_only',
      assertions: ['seed_twice_same_ids_and_rows', 'no_user_role_or_module_assignments', 'translations_es_en_added_atomically', 'translation_failure_rolls_back_module_and_group',
        'existing_group_rename_module_move_and_inactivity_preserved', 'existing_custom_module_key_reused_by_route', 'ambiguity_refused_without_merging'],
      configured_database_seed_executed: false, provider_calls: 0, cleanup: 'disposable_database_dropped_in_finally' };
    await save('teacher-navigation-rehearsal.json', report); console.log(JSON.stringify(report));
  } else if (mode === 'archive-rehearse') {
    const teacher = await loadMigration('1793570000000-CreateTeacherDomain.ts', 'CreateTeacherDomain1793570000000');
    const bridge = await loadMigration('1793580000000-SharedAiGenerationOwnership.ts', 'SharedAiGenerationOwnership1793580000000');
    const archive = await loadMigration('1793590000000-PreserveTeacherArchivedPauseState.ts', 'PreserveTeacherArchivedPauseState1793590000000');
    runSnapshot('verify-before'); disposable = `nodia_routes_20261101_${Date.now()}`;
    await source.query(`CREATE DATABASE ${quote(disposable)}`); disposableCreated = true; runSnapshot('restore', disposable);
    copy = await new DataSource({ ...options, database: disposable }).initialize();
    const step = (entry, direction) => copy.transaction(manager => new entry.Migration()[direction](manager.queryRunner));
    await step(teacher, 'up'); await step(bridge, 'up');
    const before = await fingerprint(copy), beforeSchema = await schemaFingerprint(copy);
    await step(archive, 'up'); const onceSchema = await schemaFingerprint(copy);
    await step(archive, 'down');
    assert.equal(await schemaFingerprint(copy), beforeSchema); assert.deepEqual(await fingerprint(copy), before);
    await step(archive, 'up'); assert.equal(await schemaFingerprint(copy), onceSchema);
    await assert.rejects(copy.transaction(async manager => {
      const [actor] = await manager.query("INSERT INTO users(email,is_active) VALUES('archive-frame-synthetic@example.invalid',true) RETURNING id::text");
      await manager.query(`INSERT INTO teacher_sessions(id,owner_user_id,topic,objective,explanation_language,created_by_actor_id,state,archived_state,resume_state)
        VALUES($1,$2,'Synthetic nested pause','Preserve exact cursor','es',$2,'archived','paused','active')`, [randomUUID(), actor.id]);
      await new archive.Migration().down(manager.queryRunner);
    }), /Teacher archive rollback refused/);
    await assert.rejects(copy.transaction(async manager => {
      const [actor] = await manager.query("INSERT INTO users(email,is_active) VALUES('legacy-archive-synthetic@example.invalid',true) RETURNING id::text");
      await manager.query(`INSERT INTO teacher_sessions(id,owner_user_id,topic,objective,explanation_language,created_by_actor_id,state)
        VALUES($1,$2,'Synthetic ambiguous legacy','Do not infer historical state','es',$2,'archived')`, [randomUUID(), actor.id]);
      await manager.query('SET CONSTRAINTS ALL IMMEDIATE');
      await new archive.Migration().down(manager.queryRunner);
      await new archive.Migration().up(manager.queryRunner);
    }), /requires reconciliation/);
    assert.equal(await schemaFingerprint(copy), onceSchema);
    const report = { ok: true, migration: 'PreserveTeacherArchivedPauseState1793590000000', sha256: archive.sha256,
      scope: 'disposable_restored_database_only', assertions: ['up_down_up_schema_equal', 'down_preserves_existing_rows',
        'occupied_nested_archive_frame_prevents_down', 'ambiguous_legacy_archived_rows_prevent_up', 'failed_transitions_commit_nothing'],
      configured_database_migrated: false, provider_calls: 0, cleanup: 'disposable_database_dropped_in_finally' };
    await save('archive-migration-rehearsal.json', report); console.log(JSON.stringify(report));
  } else if (mode === 'archive-apply') {
    const archive = await loadMigration('1793590000000-PreserveTeacherArchivedPauseState.ts', 'PreserveTeacherArchivedPauseState1793590000000');
    const checked = JSON.parse(await readFile(new URL('archive-migration-rehearsal.json', artifacts), 'utf8'));
    assert.equal(checked.ok, true); assert.equal(checked.sha256, archive.sha256);
    const packet = new URL('ops/lab/artifacts/teacher-archive-local-20261101-r01/', root);
    await mkdir(packet, { recursive: true });
    const script = new URL('database_snapshot.py', packet);
    await writeFile(script, await readFile(new URL('database_snapshot.py', artifacts)));
    const backup = (...args) => JSON.parse(execFileSync('python', [fileURLToPath(script), ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 }));
    const idle = await source.transaction(async manager => { await manager.query('SET TRANSACTION READ ONLY'); return runtimeInventory(manager); });
    assert.ok(Object.values(idle).every(count => count === 0), 'live_runtime_requires_real_closure');
    const beforeBackup = backup('capture-before');
    const report = await source.transaction('REPEATABLE READ', async manager => {
      await manager.query("SET LOCAL lock_timeout='2s'");
      await manager.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
      await manager.query("SELECT pg_advisory_xact_lock(hashtext('nodia-ai:foreground-admission'))");
      const idleLocked = await runtimeInventory(manager);
      assert.ok(Object.values(idleLocked).every(count => count === 0), 'runtime_became_active');
      const before = await fingerprint(manager);
      const name = 'PreserveTeacherArchivedPauseState1793590000000';
      const prior = await manager.query('SELECT 1 FROM migrations WHERE name=$1', [name]);
      if (!prior.length) {
        await new archive.Migration().up(manager.queryRunner);
        await manager.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)', [1793590000000, name]);
      }
      const after = await fingerprint(manager), projected = await fingerprint(manager, [], false, true);
      for (const [table, state] of Object.entries(before)) if (table !== 'migrations') assert.deepEqual(projected[table], state, `preserve ${table}`);
      return { ok: true, environment: { host: options.host, port: options.port, database: options.database, container: 'nodia_postgres' },
        migration: name, sha256: archive.sha256, before, after, runtime_before: idle, runtime_under_locks: idleLocked,
        original_tables_preserved: Object.keys(before).filter(table => table !== 'migrations'), already_applied: prior.length > 0,
        added_column: 'teacher_sessions.archived_state nullable; no inferred values', applied_at: new Date().toISOString(),
        provider_calls: 0, assignments_created: 0, api_or_worker_restarted: false, vm_or_production_touched: false, credential_or_profile_changes: false };
    });
    report.backup_before = beforeBackup; report.backup_after = backup('capture-after');
    await writeFile(new URL('application.json', packet), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, migration: report.migration, sha256: report.sha256, environment: report.environment,
      original_tables_preserved: report.original_tables_preserved.length, runtime_idle: idle, provider_calls: 0, restarted: false, backup_verified: true }));
  } else if (mode === 'bridge-apply') {
    const teacher = await loadMigration('1793570000000-CreateTeacherDomain.ts', 'CreateTeacherDomain1793570000000');
    const bridge = await loadMigration('1793580000000-SharedAiGenerationOwnership.ts', 'SharedAiGenerationOwnership1793580000000');
    const checked = JSON.parse(await readFile(new URL('bridge-migration-rehearsal.json', artifacts), 'utf8'));
    assert.deepEqual(checked.migrations.map(item => item.sha256), [teacher.sha256, bridge.sha256], 'exact_rehearsed_migration_hashes_required');
    const bridgeArtifacts = new URL('ops/lab/artifacts/teacher-domain-local-20261101-r01/', root);
    await mkdir(bridgeArtifacts, { recursive: true });
    const backupScript = new URL('database_snapshot.py', bridgeArtifacts);
    await writeFile(backupScript, await readFile(new URL('database_snapshot.py', artifacts)));
    const backup = (...args) => JSON.parse(execFileSync('python', [fileURLToPath(backupScript), ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 }));
    const idleBefore = await source.transaction(async manager => {
      await manager.query('SET TRANSACTION READ ONLY'); return runtimeInventory(manager);
    });
    await writeFile(new URL('runtime-before.json', bridgeArtifacts), `${JSON.stringify(idleBefore, null, 2)}\n`);
    assert.ok(Object.values(idleBefore).every(count => count === 0), 'live_runtime_requires_reconciliation_no_artificial_closure');
    const beforeBackup = backup('capture-before');
    const report = await source.transaction('REPEATABLE READ', async manager => {
      await manager.query("SET LOCAL lock_timeout='2s'");
      await manager.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
      await manager.query("SELECT pg_advisory_xact_lock(hashtext('nodia-ai:foreground-admission'))");
      const idleLocked = await runtimeInventory(manager);
      assert.ok(Object.values(idleLocked).every(count => count === 0), 'runtime_became_active_retry_inventory_after_real_closure');
      const before = await fingerprint(manager);
      const entries = [
        { name: 'CreateTeacherDomain1793570000000', stamp: 1793570000000, ...teacher },
        { name: 'SharedAiGenerationOwnership1793580000000', stamp: 1793580000000, ...bridge },
      ];
      const applied = [];
      for (const entry of entries) {
        const prior = await manager.query('SELECT 1 FROM migrations WHERE name=$1', [entry.name]);
        if (prior.length) continue;
        await new entry.Migration().up(manager.queryRunner);
        await manager.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)', [entry.stamp, entry.name]);
        applied.push({ name: entry.name, sha256: entry.sha256 });
      }
      const after = await fingerprint(manager);
      const comparableAfter = await fingerprint(manager, [], true);
      for (const [table, state] of Object.entries(before)) if (table !== 'migrations') assert.deepEqual(comparableAfter[table], state, `preserve original rows ${table}`);
      assert.equal(after.ai_generation_operations.count, '0');
      assert.equal(after.ai_generation_qualifications.count, '0');
      assert.equal(after.teacher_sessions.count, '0');
      return { ok: true, scope: 'local_working_database_only', environment: { host: options.host, port: options.port, database: options.database, container: 'nodia_postgres' },
        applied, before, after, original_tables_preserved: Object.keys(before).filter(table => table !== 'migrations'),
        idle_before: idleBefore, idle_under_authority_and_queue_locks: idleLocked, generation_qualifications: 0,
        api_or_worker_restarted: false, vm_or_production_touched: false, provider_calls: 0, assignments_created: 0,
        credential_or_profile_changes: false, rows_projection: 'existing slot fields preserved; additive generation_operation_id starts null', applied_at: new Date().toISOString() };
    });
    report.backup_before = beforeBackup; report.backup_after = backup('capture-after');
    await writeFile(new URL('application.json', bridgeArtifacts), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, applied: report.applied, environment: report.environment, original_tables_preserved: report.original_tables_preserved.length,
      runtime_idle: report.idle_before, new_qualifications: 0, provider_calls: 0, restarted: false, backup_verified: true }));
  } else if (mode === 'bridge-rehearse') {
    const teacher = await loadMigration('1793570000000-CreateTeacherDomain.ts', 'CreateTeacherDomain1793570000000');
    const bridge = await loadMigration('1793580000000-SharedAiGenerationOwnership.ts', 'SharedAiGenerationOwnership1793580000000');
    runSnapshot('verify-before');
    disposable = `nodia_routes_20261101_${Date.now()}`;
    await source.query(`CREATE DATABASE ${quote(disposable)}`); disposableCreated = true;
    runSnapshot('restore', disposable);
    copy = await new DataSource({ ...options, database: disposable }).initialize();
    const original = await fingerprint(copy), originalSchema = await schemaFingerprint(copy);
    const step = async (entry, direction) => copy.transaction(async manager => new entry.Migration()[direction](manager.queryRunner));
    await step(teacher, 'up'); await step(bridge, 'up');
    const firstSchema = await schemaFingerprint(copy);
    await step(bridge, 'down'); await step(teacher, 'down');
    assert.equal(await schemaFingerprint(copy), originalSchema, 'bridge + Teacher down restore original schema');
    assert.deepEqual(await fingerprint(copy), original, 'bridge + Teacher down preserve every original table');
    await step(teacher, 'up'); await step(bridge, 'up');
    assert.equal(await schemaFingerprint(copy), firstSchema, 'bridge + Teacher up/down/up stable schema');
    const ids = { session: randomUUID(), job: randomUUID(), attempt: randomUUID(), worker: randomUUID() };
    const [provider] = await copy.query('SELECT id::text FROM ai_providers ORDER BY id LIMIT 1');
    assert.ok(provider, 'restored configured provider required; credentials are never read');
    const hash = 'a'.repeat(64), selection = { connection_id: provider.id, mode: 'api_key', model_id: 'synthetic-migration-fixture-model', effort_id: null };
    await copy.transaction(async manager => {
      const [actor] = await manager.query("INSERT INTO users(email,is_active) VALUES('bridge-synthetic@example.invalid',true) RETURNING id::text");
      ids.actor = actor.id;
      await manager.query(`INSERT INTO teacher_sessions(id,owner_user_id,topic,objective,explanation_language,created_by_actor_id)
        VALUES($1,$2,'Synthetic migration fixture','Prove durable ownership','es',$2)`, [ids.session, ids.actor]);
      await manager.query(`INSERT INTO teacher_generation_jobs(id,session_id,actor_id,purpose,semantic_key,input_snapshot,prompt_snapshot,
        template_ref,template_version,template_hash,input_hash,selection_snapshot,configuration_generation,deadline_at)
        VALUES($1,$2,$3,'setup_reply',$4,'{}','Synthetic isolated migration fixture','teacher-synthetic','1',$4,$4,$5::jsonb,'synthetic',clock_timestamp()+interval '1 minute')`,
      [ids.job, ids.session, ids.actor, hash, JSON.stringify(selection)]);
      await manager.query(`INSERT INTO teacher_generation_attempts(id,session_id,job_id,attempt_no,worker_id,fence,phase)
        VALUES($1,$2,$3,1,$4,1,'claimed')`, [ids.attempt, ids.session, ids.job, ids.worker]);
      await manager.query(`INSERT INTO ai_generation_operations(id,owner_kind,teacher_attempt_id,teacher_job_id,teacher_session_id,actor_id,
        connection_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit)
        VALUES($1,'teacher',$1,$2,$3,$4,$5,$6::jsonb,'synthetic','synthetic','synthetic-shared-resource',$7,1,1,'reserved',$8,1)`,
      [ids.attempt, ids.job, ids.session, ids.actor, provider.id, JSON.stringify(selection), ids.worker, hash]);
      await manager.query(`INSERT INTO nodia_ai_runtime_slots(resource_key,state,generation_operation_id,holder_worker_id,fence,lease_until)
        VALUES('synthetic-shared-resource','held',$1,$2,1,clock_timestamp()+interval '1 minute')`, [ids.attempt, ids.worker]);
    });
    const occupied = await fingerprint(copy);
    await assert.rejects(step(bridge, 'down'), /ai_generation_rollback_requires_reconciliation/);
    await assert.rejects(step(teacher, 'down'), /Teacher rollback refused/);
    assert.deepEqual(await fingerprint(copy), occupied, 'failed down never deletes admitted operations/sessions');
    await assert.rejects(copy.transaction(async manager => manager.query(
      "UPDATE nodia_ai_runtime_slots SET state='free',holder_worker_id=NULL,lease_until=NULL WHERE resource_key='synthetic-shared-resource'")), error => error.code === '23514');
    await assert.rejects(copy.transaction(async manager => manager.query(
      "UPDATE ai_generation_operations SET started_exchanges=1,reserved_exchanges=0 WHERE id=$1", [ids.attempt])), error => error.code === '23514');
    await assert.rejects(copy.transaction(async manager => manager.query(
      "UPDATE ai_generation_operations SET chat_attempt_id=$1 WHERE id=$1", [ids.attempt])), error => error.code === '23514' || error.code === '23503');
    await assert.rejects(copy.transaction(async manager => manager.query(
      "UPDATE teacher_generation_attempts SET session_id=$1 WHERE id=$2", [randomUUID(), ids.attempt])), error => error.code === '23503');
    assert.deepEqual(await fingerprint(copy), occupied, 'invalid owner/budget/free-slot transitions commit nothing');
    const report = { ok: true, scope: 'isolated_restored_database_only', migrations: [
      { name: 'CreateTeacherDomain1793570000000', sha256: teacher.sha256 },
      { name: 'SharedAiGenerationOwnership1793580000000', sha256: bridge.sha256 }],
      assertions: ['up_down_up_schema_equal', 'all_original_rows_preserved_on_down', 'admitted_teacher_operation_survives_failed_down',
        'teacher_held_slot_without_fake_chat_accepted', 'free_slot_cannot_retain_teacher_operation', 'started_exchange_requires_reservation',
        'xor_owner_enforced', 'composite_teacher_ownership_fk_enforced'],
      original_tables: Object.keys(original).length, resulting_tables: Object.keys(occupied).length,
      configured_database_migrated: false, credential_values_read: false, provider_calls: 0, cleanup: 'disposable_database_dropped_in_finally' };
    await save('bridge-migration-rehearsal.json', report); console.log(JSON.stringify(report));
  } else if (mode === 'rehearse') {
    await readFile(new URL('inventory.json', artifacts)); // The read-only inventory precedes any mutation.
    const backup = runSnapshot('capture-before');
    disposable = `nodia_routes_20261101_${Date.now()}`;
    assert.match(disposable, /^nodia_routes_20261101_\d+$/);
    await source.query(`CREATE DATABASE ${quote(disposable)}`); disposableCreated = true;
    const restored = runSnapshot('restore', disposable);
    copy = await new DataSource({ ...options, database: disposable }).initialize();
    const original = await fingerprint(copy);
    const originalModules = await modules(copy);
    await verifyAuthority(copy);
    const expected = originalModules.map(row => ({ ...row, link: mapping.find(([from]) => from === row.link)?.[1] ?? row.link }));
    await migrate(copy, 'up');
    await verifyAuthority(copy);
    assert.deepEqual(await modules(copy), expected, 'exact links and all module fields');
    assert.deepEqual(await fingerprint(copy, ['modules', 'module_link_migration_179356']), Object.fromEntries(Object.entries(original).filter(([table]) => table !== 'modules')), 'all other tables');
    const once = await fingerprint(copy);
    await migrate(copy, 'up');
    assert.deepEqual(await fingerprint(copy), once, 'repeat up does not change rows or ledger');
    // A changed/deleted destination must stop rollback instead of overwriting a user's edit.
    const [ledger] = await copy.query('SELECT module_id::text FROM module_link_migration_179356 ORDER BY module_id LIMIT 1');
    if (ledger) {
      await assert.rejects(copy.transaction(async manager => {
        await manager.query("UPDATE modules SET link='/synthetic-changed-after-migration' WHERE id=$1", [ledger.module_id]);
        await new Migration().down(manager.queryRunner);
      }), /canonical_module_links_rollback_conflict/);
    }
    await migrate(copy, 'down');
    await migrate(copy, 'down');
    assert.deepEqual(await fingerprint(copy), original, 'down restores original rows and repeat down is safe');
    // Enumerated aliases pointing at two records never merge authority/assignments.
    if (originalModules.length) {
      const alias = mapping.find(([from]) => originalModules.some(row => row.link === from));
      if (alias) await assert.rejects(copy.transaction(async manager => {
        const [row] = await manager.query(`INSERT INTO modules(key,link,module_group_id,sort_order,is_active)
          SELECT 'synthetic_route_collision', $1, module_group_id,
          (SELECT coalesce(max(sort_order),0)+1 FROM modules WHERE module_group_id=m.module_group_id),true
          FROM modules m WHERE link=$2 LIMIT 1 RETURNING id`, [alias[1], alias[0]]);
        assert.ok(row);
        await new Migration().up(manager.queryRunner);
      }), /canonical_module_links_collision/);
    }
    assert.deepEqual(await fingerprint(copy), original, 'collision has no committed effects');
    await migrate(copy, 'up');
    await migrate(copy, 'down');
    assert.deepEqual(await fingerprint(copy), original, 'up/down/up/down stays reversible');
    const report = { ok: true, migration: name, migration_sha256: migrationHash, database: disposable,
      backup, restored, original_table_count: Object.keys(original).length,
      changed_links: originalModules.filter((row, index) => row.link !== expected[index].link).length,
      assertions: ['exact_mapping', 'module_ids_fields_and_relationships_preserved', 'all_other_table_fingerprints_preserved', 'repeat_up', 'repeat_down', 'rollback_refuses_new_edits', 'collision_atomic_rollback', 'full_snapshot_restore', 'up_down_up_down',
        'real_sql_authority_before_and_after', 'group_rename_and_module_move_preserve_access', 'revocation_denies', 'preexisting_ambiguity_still_denies'],
      cleanup: 'disposable_database_dropped_in_finally' };
    await save('rehearsal.json', report);
    console.log(JSON.stringify(report));
  } else if (mode === 'apply') {
    const rehearsal = JSON.parse(await readFile(new URL('rehearsal.json', artifacts), 'utf8'));
    assert.equal(rehearsal.ok, true); assert.equal(rehearsal.migration_sha256, migrationHash);
    const backup = runSnapshot('verify-before');
    assert.equal(backup.decrypt_verified, true); assert.equal(backup.archive_toc_verified, true);
    const result = await source.transaction('REPEATABLE READ', async manager => {
      // Read/write authority lock before a snapshot: same frontier as every Core mutation.
      await manager.query("SET LOCAL lock_timeout='2s'");
      await manager.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
      const before = await fingerprint(manager);
      const beforeModules = await modules(manager);
      const known = await manager.query('SELECT 1 FROM migrations WHERE name=$1', [name]);
      await new Migration().up(manager.queryRunner);
      if (!known.length) await manager.query('INSERT INTO migrations(timestamp,name) VALUES ($1,$2)', [1793560000000, name]);
      const afterModules = await modules(manager);
      assert.deepEqual(afterModules, beforeModules.map(row => ({ ...row, link: mapping.find(([from]) => from === row.link)?.[1] ?? row.link })));
      const after = await fingerprint(manager);
      for (const [table, state] of Object.entries(before)) if (!['modules', 'migrations'].includes(table)) assert.deepEqual(after[table], state, `preserve ${table}`);
      return { before, after, before_modules: beforeModules, after_modules: afterModules, already_applied: known.length > 0,
        changed_links: beforeModules.filter((row, index) => row.link !== afterModules[index].link).length };
    });
    const afterBackup = runSnapshot('capture-after');
    const report = { ok: true, applied_at: new Date().toISOString(), migration: name, migration_sha256: migrationHash,
      environment: { host: options.host, port: options.port, database: options.database, container: 'nodia_postgres', scope: 'local_working_database_only' },
      ...result, backup_before: backup, backup_after: afterBackup, vm_or_production_touched: false, seed_or_teacher_migrations_executed: false };
    await save('application.json', report);
    console.log(JSON.stringify({ ok: true, migration: name, environment: report.environment, changed_links: result.changed_links, already_applied: result.already_applied, tables_preserved: Object.keys(result.before).length - 2, backup_verified: true }));
  } else throw Error('unknown_mode');
} finally {
  if (copy?.isInitialized) await copy.destroy();
  if (disposableCreated) {
    assert.match(disposable, /^nodia_routes_20261101_\d+$/);
    await source.query(`DROP DATABASE IF EXISTS ${quote(disposable)} WITH (FORCE)`);
  }
  if (source.isInitialized) await source.destroy();
}
