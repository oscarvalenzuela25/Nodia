// PostgreSQL16 disposable permission fixture; no network, real credentials or application imports.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argumentsMap = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, values) => {
  if (index % 2 === 0) items.push([value, values[index + 1]]);
  return items;
}, []));
assert.deepEqual(Object.keys(argumentsMap).sort(), ['--output', '--postgres-image']);
const image = argumentsMap['--postgres-image'];
assert.match(image, /^sha256:[a-f0-9]{64}$/);
const output = path.resolve(argumentsMap['--output']);
assert.ok(!fs.existsSync(output), 'Receipt must not overwrite prior evidence');
const source = fileURLToPath(new URL('../prepare-postgres-extensions.sql', import.meta.url));
const helper = fileURLToPath(new URL('../prepare-postgres-extensions.sh', import.meta.url));
const sql = fs.readFileSync(source, 'utf8');
const hash = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const session = randomBytes(8).toString('hex');
const label = 'nodia.production.extension-maintenance';
const name = `nodia_extension_maintenance_${session}`;
const checks = [];
const check = (condition, message) => { assert.ok(condition, message); checks.push(message); };
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 60_000,
  maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let container;
const receipt = { schema_version: 1, status: 'failed', started_at_utc: new Date().toISOString(),
  image, helper_sha256: hash(helper), sql_sha256: hash(source), scope: 'disposable_permission_and_extension_contract', checks };
try {
  assert.equal(docker('image', 'inspect', image, '--format', '{{.Id}}'), image);
  container = docker('create', '--label', `${label}=${session}`, '--name', name, '--network', 'none',
    '--memory', '512m', '--cpus', '1', '-e', 'POSTGRES_USER=extension_admin', '-e', 'POSTGRES_DB=extensions_test',
    '-e', `POSTGRES_PASSWORD=${randomBytes(20).toString('hex')}`, image);
  docker('start', container);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { docker('exec', container, 'pg_isready', '-U', 'extension_admin', '-d', 'extensions_test'); ready = true; break; }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); }
  }
  assert.ok(ready, 'PostgreSQL readiness');
  const run = (input, { user = 'extension_admin', database = 'extensions_test' } = {}) => spawnSync('docker', [
    'exec', '-i', container, 'psql', '--no-psqlrc', '--username', user, '--dbname', database,
    '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose', '--tuples-only', '--no-align', '--file=-',
  ], { input, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
  const success = (input, options) => { const result = run(input, options); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  receipt.postgres_version_num = Number(success("SELECT current_setting('server_version_num');"));
  check(receipt.postgres_version_num >= 160000 && receipt.postgres_version_num < 170000, 'postgres16');
  success(`CREATE ROLE nodia_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT USAGE,CREATE ON SCHEMA public TO nodia_app;`);
  const privilegeState = () => success(`SELECT has_database_privilege(current_user,current_database(),'CREATE'),
    has_schema_privilege(current_user,'public','USAGE'),has_schema_privilege(current_user,'public','CREATE');`, { user: 'nodia_app' });
  check(privilegeState() === 'f|t|t', 'normal_role_has_schema_create_without_database_create');
  const refused = run(sql, { user: 'nodia_app' });
  check(refused.status !== 0 && refused.stderr.includes('42501'), 'normal_role_extension_install_rejected');
  check(success("SELECT count(*) FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm');") === '0', 'rejected_install_left_no_extensions');
  success(sql);
  const extensionState = () => success(`SELECT e.extname,e.extversion,n.nspname,e.oid FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname IN ('uuid-ossp','pg_trgm') ORDER BY e.extname;`);
  const beforeRepeat = extensionState();
  check(beforeRepeat.split('\n').length === 2 && beforeRepeat.split('\n').every(line => line.split('|')[2] === 'public'), 'admin_installed_both_extensions_in_public');
  success(sql);
  check(extensionState() === beforeRepeat, 'repeated_admin_maintenance_preserves_extension_identities');
  check(privilegeState() === 'f|t|t', 'normal_role_database_create_still_denied');
  const usage = success(`CREATE TABLE public.synthetic_extension_probe(id uuid DEFAULT public.uuid_generate_v4(),label text NOT NULL);
    CREATE INDEX synthetic_extension_probe_gin ON public.synthetic_extension_probe USING gin(label public.gin_trgm_ops);
    INSERT INTO public.synthetic_extension_probe(label) VALUES('synthetic sample');
    SELECT bool_and(id IS NOT NULL), public.similarity('synthetic sample','synthetic sample')=1 FROM public.synthetic_extension_probe;
    DROP TABLE public.synthetic_extension_probe;`, { user: 'nodia_app' });
  check(usage.includes('t|t'), 'normal_role_uses_uuid_function_trigram_function_and_operator_class');
  check(privilegeState() === 'f|t|t', 'extension_usage_does_not_escalate_database_privilege');
  check(success("SELECT count(*) FROM pg_tables WHERE schemaname='public';") === '0', 'maintenance_creates_no_application_tables');
  success('CREATE DATABASE wrong_schema;');
  success('CREATE SCHEMA extension_elsewhere; CREATE EXTENSION pg_trgm WITH SCHEMA extension_elsewhere;', { database: 'wrong_schema' });
  const wrong = run(sql, { database: 'wrong_schema' });
  check(wrong.status !== 0 && wrong.stderr.includes('outside public'), 'existing_extension_in_other_schema_rejected');
  check(success(`SELECT e.extname,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname IN ('uuid-ossp','pg_trgm') ORDER BY e.extname;`, { database: 'wrong_schema' }) === 'pg_trgm|extension_elsewhere',
  'wrong_schema_rejection_does_not_move_or_partially_install_extensions');
  receipt.status = 'passed';
  receipt.authentication_or_tls_qualified = false;
  receipt.production_connections_requested = false;
} catch (error) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output + '.log', String(error.stack), { mode: 0o600 });
} finally {
  receipt.cleanup = { containers_removed: 0, errors: [] };
  if (container) {
    try {
      const inspection = JSON.parse(docker('inspect', container))[0];
      assert.equal(inspection.Config.Labels[label], session);
      docker('rm', '--force', '--volumes', container);
      receipt.cleanup.containers_removed = 1;
    } catch { receipt.cleanup.errors.push('owned_container_cleanup_failed'); receipt.status = 'failed'; }
  }
  receipt.finished_at_utc = new Date().toISOString();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
}
console.log(JSON.stringify(receipt));
if (receipt.status !== 'passed') process.exitCode = 1;
