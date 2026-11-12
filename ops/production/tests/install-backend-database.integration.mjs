// SQL reader integration only. The fixture never invokes install mode, PID1 or R2.
// Adapt the existing disposable rehearsal to import the exact production reader.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const source = fileURLToPath(new URL('../rehearse-first-install.mjs', import.meta.url));
const action = fileURLToPath(new URL('../install-backend-database.mjs', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const original = fs.readFileSync(source, 'utf8');
assert.equal(createHash('sha256').update(original).digest('hex'), '6056b8d42ff90373ff058fe93392c277251ee0ed021a0ab813b7c7fd29b9f339',
  'Review changed rehearsal before adapting its fixture');
const stageMarker = "    docker('stop', stage);";
const queryMarker = "    checks.push('exact_migration_ledger');";
assert.equal(original.split(stageMarker).length, 2);
assert.equal(original.split(queryMarker).length, 2);
const sqlCheck = `
    const action = await import('/node/installation-action.mjs');
    const verificationClient = new Client({ host: 'pg', port: 5432, database: 'install_test', user: 'install_test',
      password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    try {
      await verificationClient.connect();
      await verificationClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const privilege = (await verificationClient.query('SELECT rolsuper,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];
      assert.equal(privilege.rolsuper, false); assert.equal(privilege.rolcreatedb, false);
      const verified = await action.readInstallationMetadata(verificationClient, db, process.env);
      assert.equal(verified.migrations_verified, 45); assert.equal(verified.entity_tables_verified, 68);
      assert.equal(verified.users, 1); assert.equal(verified.core_assignments, 4); assert.equal(verified.provider_credentials, 0);
      await assert.rejects(action.readInstallationMetadata(verificationClient, db,
        { ...process.env, BOOTSTRAP_SUPER_ADMIN_EMAIL: 'wrong-fixture@example.com' }), /bootstrap_identity_mismatch/);
      await assert.rejects(action.readInstallationMetadata(verificationClient, db,
        { ...process.env, POSTGRES_DB: 'wrong_fixture' }), /postcheck_database_invalid/);
      await verificationClient.query('ROLLBACK');
      checks.push('exact_new_installer_SQL_reader_45_migrations_68_entities_identity_and_destination');
    } finally { await action.closeInstallationClient(verificationClient); }
`;
const temporary = fs.mkdtempSync(path.join(repo, '.tmp/production/installation-verifier-'));
const generated = path.join(temporary, 'rehearsal.mjs');
try {
  let adapted = original.replace(stageMarker, `    docker('cp', ${JSON.stringify(action)}, \`\${stage}:/node/installation-action.mjs\`);\n${stageMarker}`)
    .replace(queryMarker, queryMarker + sqlCheck);
  const roleMarker = "'-e', 'POSTGRES_USER=install_test'";
  const readyMarker = "    docker('exec', redis, 'redis-cli', '-a', redisPassword, '--no-auth-warning', 'PING');";
  const routineMarker = "WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS routines";
  const partialMarker = "    await db.query('CREATE DATABASE partial_install');";
  for (const marker of [roleMarker, readyMarker, routineMarker, partialMarker]) assert.equal(adapted.split(marker).length, 2);
  const prepareRole = `
    docker('exec', pg, 'psql', '-U', 'fixture_admin', '-d', 'install_test', '-v', 'ON_ERROR_STOP=1', '-c',
      \`CREATE ROLE install_test LOGIN PASSWORD '\${password}'; ALTER DATABASE install_test OWNER TO install_test;
      ALTER SCHEMA public OWNER TO install_test; CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;\`);
    docker('exec', pg, 'psql', '-U', 'fixture_admin', '-d', 'install_test', '-v', 'ON_ERROR_STOP=1', '-c',
      'CREATE DATABASE partial_install OWNER install_test');
`;
  adapted = adapted.replace(roleMarker, "'-e', 'POSTGRES_USER=fixture_admin'")
    .replace(readyMarker, readyMarker + prepareRole)
    .replace(routineMarker, "WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) AS routines")
    .replace(partialMarker, "    await db.query('SELECT 1'); // Disposable partial DB was provisioned by fixture administrator.");
  fs.writeFileSync(generated, adapted, { mode: 0o600 });
  const result = spawnSync(process.execPath, [generated, ...process.argv.slice(2)], { stdio: 'inherit', timeout: 360000 });
  assert.equal(result.status, 0, 'Disposable SQL reader rehearsal failed');
  const outputIndex = process.argv.indexOf('--output');
  assert.ok(outputIndex >= 0 && process.argv[outputIndex + 1]);
  const receiptPath = path.resolve(process.argv[outputIndex + 1]);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'passed'); assert.deepEqual(receipt.cleanup.errors, []);
  receipt.SQL_reader_fixture = { role_superuser: false, role_createdb: false, required_extensions_preinstalled: true,
    exact_reader_sha256: createHash('sha256').update(fs.readFileSync(action)).digest('hex'),
    base_rehearsal_sha256: createHash('sha256').update(original).digest('hex'),
    PID1_wrapper_executed: false, journal_or_R2_access: false, operational_database_access: false };
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
} finally {
  fs.unlinkSync(generated);
  fs.rmdirSync(temporary);
}
