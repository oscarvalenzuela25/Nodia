// Fresh-process standalone worker regression. Configured DB, provider profiles and inference are never used.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const expectedEntities = [
  ['business/entities/business.entity', 'Business'],
  ['business/entities/business-collaborator.entity', 'BusinessCollaborator'],
  ['business-action/entities/business-action.entity', 'BusinessAction'],
  ['product/entities/product.entity', 'Product'],
  ['product/entities/product-log.entity', 'ProductLog'],
  ['provider/entities/provider.entity', 'Provider'],
  ['provider-contact/entities/provider-contact.entity', 'ProviderContact'],
  ['invoice/entities/invoice.entity', 'Invoice'],
  ['user/entities/user-role.entity', 'UserRole'],
  ['translation/entities/translation.entity', 'Translation'],
  ['ai-provider/entities/ai-provider.entity', 'AiProvider'],
  ['ai-provider/entities/ai-api-key.entity', 'AiApiKey'],
  ['ai-provider/entities/ai-provider-catalog.entity', 'AiProviderCatalog'],
  ['ai-provider/entities/ai-provider-event.entity', 'AiProviderEvent'],
  ['finance-category/entities/finance-category.entity', 'FinanceCategory'],
];
const load = async (path, name) => (await import(`../dist/${path}.js`))[name];
if (process.argv.some((arg) => arg.startsWith('--child'))) {
  const failure = (error) => {
    const types = [
      'Error',
      'TypeError',
      'AssertionError',
      'EntityMetadataNotFoundError',
      'QueryFailedError',
    ];
    const codes = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_ASSERTION'];
    const ownLine = String(error?.stack ?? '').match(
      /nodia-ai-ai15-worker-metadata\.integration\.mjs:(\d+)/,
    )?.[1];
    console.log(
      JSON.stringify({
        scope: 'synthetic_worker_fixture_failure',
        error_type: types.includes(error?.name) ? error.name : 'Other',
        error_code: codes.includes(error?.code) ? error.code : null,
        own_line: ownLine ? Number(ownLine) : null,
      }),
    );
    process.exitCode = 1;
  };
  process.once('uncaughtException', failure);
  process.once('unhandledRejection', failure);
}

if (process.argv.includes('--child-empty')) {
  const Products = await load(
    'nodia-ai-products/nodia-ai-product-reads.module',
    'NodiaAiProductReadsModule',
  );
  const empty = Products.forPublication([]);
  assert.equal(empty.imports, undefined);
  assert.equal(empty.providers.length, 1);
  assert.deepEqual(empty.providers[0].useValue, []);
  console.log(
    JSON.stringify({
      scope: 'fresh_worker_empty_publication',
      status: 'passed',
      runtime_initialization: false,
    }),
  );
} else if (process.argv.includes('--child')) {
  const fixture = JSON.parse(process.env.NODIA_AI_WORKER_SYNTHETIC_INPUT);
  const { Test } = await import('@nestjs/testing');
  const { DataSource } = await import('typeorm');
  const Worker = await load('nodia-ai-worker.module', 'NodiaAiWorkerModule');
  const Families = await load(
    'nodia-ai-products/nodia-ai-product-reads.module',
    'NODIA_AI_CANDIDATE_READ_FAMILIES',
  );
  const Registry = await load(
    'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
    'NodiaAiToolRegistryUseCase',
  );
  let module;
  try {
    // Actual WorkerModule autoLoadEntities; no explicit entities and no application lifecycle init.
    module = await Test.createTestingModule({ imports: [Worker] }).compile();
    const db = module.get(DataSource);
    const [readonly] = await db.query('SHOW default_transaction_read_only');
    assert.equal(readonly.default_transaction_read_only, 'on');
    const metadata = [];
    for (const [path, name] of expectedEntities)
      metadata.push({
        entity: name,
        registered: db.hasMetadata(await load(path, name)),
      });
    const baseline = process.argv.includes('--expect-missing');
    const business = metadata.find((item) => item.entity === 'Business');
    const ai = metadata.find((item) => item.entity === 'AiProvider');
    if (baseline) {
      assert.equal(business.registered, false);
      assert.equal(ai.registered, false);
    } else
      assert.ok(
        metadata.every((item) => item.registered),
        'Every local native repository needs actual worker metadata',
      );
    assert.equal(
      metadata.find((item) => item.entity === 'FinanceCategory').registered,
      true,
    );
    assert.ok(
      db.entityMetadatas.every((item) =>
        item.relations.every((relation) => db.hasMetadata(relation.type)),
      ),
      'Relationship targets must be registered',
    );
    const families = module.get(Families),
      registry = module.get(Registry);
    const routes = [
      ...new Set(
        families.flatMap((family) => family.modules.map((item) => item.route)),
      ),
    ];
    const actor = {
      actorId: fixture.identity.userId,
      sessionId: fixture.identity.sessionId,
      isSuperAdmin: true,
      modules: [],
    };
    const reads = [
      ['nodia_businesses_list', {}, fixture.markers.business],
      ['nodia_finance_categories_list', {}, fixture.markers.finance],
      ['nodia_rental_properties_list', {}, fixture.markers.rental],
      ['nodia_roles_list', {}, fixture.markers.core],
      ['nodia_ai_providers_list', {}, fixture.markers.ai],
    ];
    const results = [];
    for (const [name, input, marker] of reads) {
      if (
        baseline &&
        ![
          'nodia_businesses_list',
          'nodia_finance_categories_list',
          'nodia_ai_providers_list',
        ].includes(name)
      )
        continue;
      const tool = registry.get(name);
      assert.ok(tool);
      try {
        await db.transaction(
          tool.readIsolation ?? 'READ COMMITTED',
          async (manager) => {
            const context = {
              actor,
              manager,
              moduleRoutes: routes,
              signal: new AbortController().signal,
              statementTimeoutMs: 5000,
              maxCollectionItems: 100,
            };
            const valid = registry.validateInput(tool, input);
            await tool.verifyAuthority(valid, context);
            const result = registry.validateOutput(
              tool,
              await tool.handler(valid, context),
            );
            await tool.verifyResultAuthority?.(valid, result, context);
            assert.ok(
              JSON.stringify(result).includes(marker),
              'Read must return an unpredictable synthetic SQL marker',
            );
          },
        );
        assert.ok(
          !baseline || name === 'nodia_finance_categories_list',
          'Baseline must reproduce missing manual-family metadata',
        );
        results.push({
          capability_id: name,
          status: 'completed',
          synthetic_sql_marker_verified: true,
        });
      } catch (error) {
        if (
          !baseline ||
          !['nodia_businesses_list', 'nodia_ai_providers_list'].includes(name)
        )
          throw error;
        assert.equal(error.constructor.name, 'EntityMetadataNotFoundError');
        results.push({
          capability_id: name,
          status: 'expected_metadata_missing',
        });
      }
    }
    assert.equal(
      (
        await db.query('SELECT count(*)::integer AS count FROM nodia_ai_jobs')
      )[0].count,
      0,
    );
    console.log(
      JSON.stringify({
        task: 'AI-15',
        scope: 'fresh_standalone_worker_metadata_and_native_sql',
        status: 'passed',
        expected_missing_baseline: baseline,
        metadata,
        entity_count: db.entityMetadatas.length,
        reads: results,
        datasource_explicit_entities_override: false,
        app_module_imported: false,
        worker_lifecycle_initialized: false,
        postgres_read_only: true,
        provider_generations: 0,
        provider_profiles_read: false,
      }),
    );
  } finally {
    await module?.close();
  }
} else {
  const { createNodiaAiIntegrationFixture } =
    await import('./nodia-ai.integration.fixture.mjs');
  const fixture = await createNodiaAiIntegrationFixture('ai15');
  let report;
  try {
    const markers = Object.fromEntries(
      ['business', 'finance', 'rental', 'core', 'ai'].map((key) => [
        key,
        `synthetic-worker-${key}-${randomBytes(8).toString('hex')}`,
      ]),
    );
    await fixture.db.query(
      'INSERT INTO businesses(name,owner_id) VALUES($1,3)',
      [markers.business],
    );
    await fixture.db.query(
      'INSERT INTO finance_categories(user_id,name,key) VALUES(3,$1,$1)',
      [markers.finance],
    );
    await fixture.db.query(
      "INSERT INTO rental_properties(owner_id,name,timezone,max_guests,minimum_turnover_minutes,created_by,updated_by) VALUES(3,$1,'America/Santiago',4,0,3,3)",
      [markers.rental],
    );
    await fixture.db.query('INSERT INTO roles(key) VALUES($1)', [markers.core]);
    await fixture.db.query(
      "INSERT INTO ai_providers(name,catalog_id,fields) SELECT $1,id,'{}' FROM ai_provider_catalog WHERE key='gemini'",
      [markers.ai],
    );
    const env = Object.fromEntries(
      [
        'PATH',
        'SystemRoot',
        'SYSTEMROOT',
        'WINDIR',
        'TEMP',
        'TMP',
        'TMPDIR',
        'LANG',
      ]
        .filter((key) => process.env[key])
        .map((key) => [key, process.env[key]]),
    );
    Object.assign(env, {
      DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null',
      NODE_ENV: 'test',
      RATE_LIMIT_STORAGE: 'memory',
      POSTGRES_HOST: fixture.options.host,
      POSTGRES_PORT: String(fixture.options.port),
      POSTGRES_USER: fixture.options.username,
      POSTGRES_PASSWORD: fixture.options.password,
      POSTGRES_DB: fixture.options.database,
      PGOPTIONS: '-c default_transaction_read_only=on',
      SECRET_SEED: randomBytes(32).toString('hex'),
      NODIA_CODEX_ENABLED: 'false',
      NODIA_AI_WORKER_SYNTHETIC_INPUT: JSON.stringify({
        identity: fixture.identities.get('3'),
        markers,
      }),
    });
    const runChild = (args) =>
      new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [fileURLToPath(import.meta.url), ...args],
          { env, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let output = '',
          errorBytes = 0;
        child.stdout.on('data', (chunk) => {
          output += chunk.toString();
          if (output.length > 65536) child.kill();
        });
        child.stderr.on('data', (chunk) => {
          errorBytes += chunk.length;
          if (errorBytes > 65536) child.kill();
        });
        const timer = setTimeout(() => child.kill(), 45000);
        child.on('error', reject);
        child.on('exit', (code) => {
          clearTimeout(timer);
          const rows = output
            .trim()
            .split('\n')
            .filter((line) => line.startsWith('{'));
          const result = rows.length ? JSON.parse(rows.at(-1)) : null;
          if (code !== 0)
            reject(
              new Error(
                `Fresh worker fixture failed; exit=${code}, stderr_bytes=${errorBytes}; safe_diagnostic=${JSON.stringify(result)}`,
              ),
            );
          else resolve(result);
        });
      });
    const empty = await runChild(['--child-empty']);
    const result = await runChild([
      '--child',
      ...(process.argv.includes('--expect-missing')
        ? ['--expect-missing']
        : []),
    ]);
    report = {
      ...result,
      empty_publication: empty,
      configured_database_modified: false,
    };
  } finally {
    await fixture.close();
  }
  report.disposable_database_removed = true;
  if (process.env.NODIA_AI_LAB_REPORT_JSON)
    fs.writeFileSync(
      process.env.NODIA_AI_LAB_REPORT_JSON,
      JSON.stringify(report, null, 2),
    );
  console.log(JSON.stringify(report, null, 2));
}
