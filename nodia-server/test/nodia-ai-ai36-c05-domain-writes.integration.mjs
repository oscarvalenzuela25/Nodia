// Successor of C01: preserve its assertions and add the previously absent MCP
// update/delete/ref-integrity boundary. Generated module exists only in memory.
// This runner uses disposable PostgreSQL and synthetic publication/provider.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const baseUrl = new URL(
  './nodia-ai-ai36-write-preparation.integration.mjs',
  import.meta.url,
);
const bytes = await readFile(baseUrl);
const baseSha =
  'f995b3edeb277b6bd38d48f04e5507eb5fe7e24cada58679d66b779d6c064a40';
assert.equal(
  createHash('sha256').update(bytes).digest('hex'),
  baseSha,
  'C01 source changed: review successor transformations before running',
);
let source = bytes.toString('utf8');
const replaceOnce = (before, after) => {
  assert.equal(
    source.split(before).length,
    2,
    'C01 extension anchor is not unique',
  );
  source = source.replace(before, after);
};
replaceOnce(
  "const names = ['nodia_finance_movements_prepare_create', 'nodia_providers_prepare_create'];",
  "const names = ['nodia_finance_movements_prepare_create', 'nodia_providers_prepare_create', 'nodia_finance_movements_prepare_update', 'nodia_finance_movements_prepare_delete', 'nodia_finance_categories_prepare_delete'];",
);
replaceOnce(
  'assert.equal(families.flatMap(family => family.capabilities).length, 2);',
  'assert.equal(families.flatMap(family => family.capabilities).length, 5);',
);
replaceOnce(
  'real admission and worker expose the two explicitly synthetic-published native preparers',
  'real admission and worker expose the five explicitly synthetic-published native preparers',
);
replaceOnce(
  "check('three synthetic worker dispatches have no actual provider, storage or production publication effects', dispatches === 3);",
  "await runDomainWriteVariants({ db, category, receipt, runScenario, call, humanConfirm, http, count, check });\n  check('six synthetic worker dispatches have no actual provider, storage or production publication effects', dispatches === 6);",
);
replaceOnce(
  "stage: 'AI-36-C01'",
  "stage: 'AI-36-C05-domain-writes', C01_source_sha256: '" + baseSha + "'",
);
// Resolve bare/relative imports using this real test location, not a data URL.
source = source.replace(
  /from '([^']+)'/gu,
  (_match, specifier) => "from '" + import.meta.resolve(specifier) + "'",
);
source =
  "import { runDomainWriteVariants } from '" +
  new URL('./nodia-ai-ai36-c05-domain-write-cases.fixture.mjs', import.meta.url)
    .href +
  "';\n" +
  source;
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 1 && args[0] === '--check-source'),
  'Only the explicit offline syntax switch is supported',
);
if (args[0] === '--check-source') {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    { input: source, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(
    result.status,
    0,
    'Generated successor module is not valid JavaScript',
  );
  console.log(
    JSON.stringify({
      status: 'generated_source_valid_not_executed',
      C01_source_sha256: baseSha,
      transformed_source_sha256: createHash('sha256')
        .update(source)
        .digest('hex'),
      guarded_transformations: 5,
      SDK_requests: 0,
      SQL_connections: 0,
      fixture_containers: 0,
    }),
  );
} else
  await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
  );
