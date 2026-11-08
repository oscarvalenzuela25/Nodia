// Laboratory only. No AppModule, worker, SDK, inference, confirmation or SQL business writer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const SOURCE = '/opt/nodia/releases/nodia-server-image-generation-r02';
export const MANIFEST_SHA = 'bd7ae69a32effe00321226619428eeda6d468fb4cf693ca80d540abe7d081e53';
export const BUSINESS = '5af15373-3638-4a02-a015-4e72c433fc11';
const PROVIDER = '1';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const integerId = /^[1-9][0-9]{0,18}$/;
const fail = code => { throw new Error(code); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export const INPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['schema_version', 'source_run_id', 'actor'],
  properties: {
    schema_version: { const: 1 },
    source_run_id: { type: 'string', format: 'uuid', description: 'NEW owned terminal run after the current session began; not an old grant.' },
    actor: { type: 'object', additionalProperties: false, required: ['userId', 'sessionId'], properties: {
      userId: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' }, sessionId: { type: 'string', format: 'uuid' },
    } },
  },
};
export function validateInput(input) {
  if (!exactKeys(input, ['schema_version', 'source_run_id', 'actor']) || input.schema_version !== 1
      || typeof input.source_run_id !== 'string' || !uuid.test(input.source_run_id) || !exactKeys(input.actor, ['userId', 'sessionId'])
      || typeof input.actor.userId !== 'string' || !integerId.test(input.actor.userId) || BigInt(input.actor.userId) > 9223372036854775807n
      || typeof input.actor.sessionId !== 'string' || !uuid.test(input.actor.sessionId)) fail('fixture_input_invalid');
  return { schema_version: 1, source_run_id: input.source_run_id, actor: { ...input.actor } };
}
export function fixtureRows() {
  return ['CDX', 'AGY'].flatMap(provider => ['UP', 'DOWN', 'SAME'].map(direction => ({
    business_id: BUSINESS, provider_id: PROVIDER,
    code: `QA-NODIA-CLOSE-${provider}-${direction}-20261026`,
    name: `QA Nodia close ${provider} ${direction} 20261026`,
    cost_price: 1000, cost_price_tax: 1190, profit_percentage: 30,
    sale_price: 1547, stock: 0, is_active: true,
  })));
}
const fields = ['business_id', 'provider_id', 'code', 'name', 'cost_price', 'cost_price_tax', 'profit_percentage', 'sale_price', 'stock', 'is_active'];
export function planExisting(existing) {
  const fixtures = fixtureRows(), byCode = new Map();
  for (const row of existing) {
    if (!fixtures.some(item => item.code === row.code) || byCode.has(row.code) || !integerId.test(String(row.id))) fail('fixture_existing_identity_invalid');
    byCode.set(row.code, row);
  }
  // Validate the WHOLE preexisting cohort before the first create. Never overwrite.
  for (const fixture of fixtures) {
    const row = byCode.get(fixture.code);
    if (row && fields.some(key => row[key] !== fixture[key])) fail('fixture_existing_values_conflict');
  }
  return fixtures.map(dto => ({ dto, existingId: byCode.has(dto.code) ? String(byCode.get(dto.code).id) : null }));
}

function verifySource() {
  if (fs.realpathSync(process.cwd()) !== SOURCE || fs.realpathSync(SOURCE) !== SOURCE) fail('fixture_source_cwd_mismatch');
  const raw = fs.readFileSync(path.join(SOURCE, 'release-manifest.json'));
  if (sha(raw) !== MANIFEST_SHA) fail('fixture_source_manifest_mismatch');
  const manifest = JSON.parse(raw.toString('utf8'));
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) fail('fixture_source_manifest_invalid');
  for (const [relative, expected] of Object.entries(manifest.files)) {
    if (path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '..' || part === '.') || relative.includes('\\')) fail('fixture_source_path_invalid');
    const file = path.join(SOURCE, relative), stat = fs.lstatSync(file);
    const expectedSha = typeof expected === 'string' ? expected : exactKeys(expected, ['sha256', 'bytes']) ? expected.sha256 : null;
    if (!stat.isFile() || stat.isSymbolicLink() || !/^[a-f0-9]{64}$/.test(expectedSha ?? '') || sha(fs.readFileSync(file)) !== expectedSha
        || (typeof expected === 'object' && (!Number.isSafeInteger(expected.bytes) || expected.bytes !== stat.size))) fail('fixture_source_file_mismatch');
  }
}
async function seed(input) {
  verifySource();
  // Parent supplies the existing private service environment; do not silently choose DB defaults.
  if (['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'].some(key => !process.env[key])) fail('fixture_private_service_environment_missing');
  const require = createRequire(path.join(SOURCE, 'package.json'));
  require('reflect-metadata');
  const load = relative => import(pathToFileURL(path.join(SOURCE, 'dist', relative)).href);
  const [{ default: db }, { Product }, { ProductLog }, { ProductService }, { CreateProductUseCase }, { CreateProductDto }, authority, access] = await Promise.all([
    load('config/data-source.js'), load('product/entities/product.entity.js'), load('product/entities/product-log.entity.js'),
    load('product/product.service.js'), load('product/use-case/create-product.use-case.js'), load('product/dto/create-product.dto.js'),
    load('authorization/authority-transaction.js'), load('business-access/business-access.js'),
  ]);
  const { plainToInstance } = require('class-transformer'), { validateSync } = require('class-validator');
  await db.initialize();
  try {
    const uc = new CreateProductUseCase(new ProductService(db.getRepository(Product), db.getRepository(ProductLog)));
    const result = await db.transaction(async manager => {
      await authority.lockAuthority(manager);
      await access.assertBusinessesAccess(manager, input.actor, [BUSINESS], { lock: true });
      const scope = await manager.query(`SELECT r.id::text FROM nodia_ai_runs r
        JOIN nodia_ai_conversations c ON c.id=r.conversation_id
        JOIN nodia_ai_messages m ON m.id=r.user_message_id
        JOIN auth_sessions s ON s.user_id=r.actor_id AND s.public_id=$3
        WHERE r.id=$1 AND r.actor_id=$2 AND c.owner_id=$2 AND m.author_id=$2
          AND r.state IN('completed','failed','cancelled') AND r.created_at>=s.created_at
          AND c.lifecycle='active' AND c.expires_at>clock_timestamp()
          AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() FOR SHARE OF r,c,s`,
      [input.source_run_id, input.actor.userId, input.actor.sessionId]);
      if (scope.length !== 1) fail('fixture_new_owned_session_run_required');
      const [quiet] = await manager.query(`SELECT
        (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN('ready','leased','waiting','unknown') OR (kind='reconcile' AND state<>'done')) jobs,
        (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,
        (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);
      if (Object.values(quiet).some(count => count !== 0)) fail('fixture_runtime_not_quiet');
      const providers = await manager.query('SELECT id::text,business_id::text FROM providers WHERE id=$1 FOR SHARE', [PROVIDER]);
      if (providers.length !== 1 || providers[0].business_id !== BUSINESS) fail('fixture_provider_scope_mismatch');
      const codes = fixtureRows().map(row => row.code);
      const existing = await manager.query(`SELECT id::text,business_id::text,provider_id::text,code,name,
        cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active
        FROM products WHERE business_id=$1 AND lower(btrim(code))=ANY($2::text[]) ORDER BY id FOR UPDATE`, [BUSINESS, codes.map(code => code.toLowerCase())]);
      const planned = planExisting(existing), output = [];
      for (const item of planned) {
        if (item.existingId) {
          output.push({ code: item.dto.code, product_id: item.existingId, created: false });
          continue;
        }
        const dto = plainToInstance(CreateProductDto, item.dto);
        if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) fail('fixture_DTO_invalid');
        const created = await uc.execute(dto, manager, input.actor);
        output.push({ code: item.dto.code, product_id: String(created.id), created: true });
      }
      const readback = await manager.query(`SELECT id::text,business_id::text,provider_id::text,code,name,
        cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active
        FROM products WHERE business_id=$1 AND code=ANY($2::text[]) ORDER BY id`, [BUSINESS, codes]);
      if (readback.length !== 6 || planExisting(readback).some(row => !row.existingId)) fail('fixture_readback_mismatch');
      return output.map(row => ({ ...row, ...Object.fromEntries(
        ['cost_price', 'cost_price_tax', 'profit_percentage', 'sale_price', 'stock', 'is_active']
          .map(key => [key, readback.find(item => item.id === row.product_id)[key]])),
      }));
    });
    return { status: 'laboratory_products_seeded_or_identical', source_manifest_sha256: MANIFEST_SHA,
      business_id: BUSINESS, provider_id: PROVIDER, products: result,
      newly_created: result.filter(row => row.created).length,
      reused_identical: result.filter(row => !row.created).length,
      product_log_behavior: 'One automatic snapshot per newly created product via native ProductService.',
      provider_generations: 0, existing_rows_overwritten: 0 };
  } finally { await db.destroy(); }
}

function selfTest() {
  const fixture = fixtureRows();
  assert.equal(fixture.length, 6); assert.equal(new Set(fixture.map(row => row.code)).size, 6);
  assert.equal(planExisting([]).filter(row => row.existingId === null).length, 6);
  assert.equal(planExisting(fixture.map((row, index) => ({ ...row, id: String(index + 1) }))).filter(row => row.existingId).length, 6);
  assert.throws(() => planExisting([{ ...fixture[0], id: '1', cost_price: 999 }]), /fixture_existing_values_conflict/);
  assert.throws(() => planExisting([{ ...fixture[0], id: '1', provider_id: '2' }]), /fixture_existing_values_conflict/);
  assert.throws(() => planExisting([{ ...fixture[0], id: '1' }, { ...fixture[0], id: '2' }]), /fixture_existing_identity_invalid/);
  assert.throws(() => validateInput({ schema_version: 1, source_run_id: 'old', actor: { userId: '1', sessionId: 'old' } }), /fixture_input_invalid/);
  assert.throws(() => validateInput({ schema_version: 1, source_run_id: '11111111-1111-4111-8111-111111111111', actor: { userId: '1', sessionId: '22222222-2222-4222-8222-222222222222', isSuperAdmin: true } }), /fixture_input_invalid/);
  assert.throws(() => validateInput({ schema_version: 1, source_run_id: '11111111-1111-4111-8111-111111111111', actor: { userId: 1, sessionId: '22222222-2222-4222-8222-222222222222' } }), /fixture_input_invalid/);
  return { status: 'offline_fixture_policy_tests_passed', no_DB_or_SDK: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) fail('fixture_mode_required');
    if (args[0] === '--schema') console.log(JSON.stringify(INPUT_SCHEMA));
    else if (args[0] === '--self-test') console.log(JSON.stringify(selfTest()));
    else if (args[0] === '--execute') {
      const raw = fs.readFileSync(0);
      if (raw.length > 8192) fail('fixture_input_too_large');
      console.log(JSON.stringify(await seed(validateInput(JSON.parse(raw.toString('utf8'))))));
    } else fail('fixture_mode_invalid');
  } catch (error) {
    const code = error instanceof Error && /^fixture_[A-Za-z_]+$/.test(error.message) ? error.message : 'fixture_seed_failed';
    console.error(JSON.stringify({ status: 'failed', code, outcome: 'unverified_after_error_read_back_exact_fixture_codes_before_rerun' }));
    process.exitCode = 1;
  }
}
