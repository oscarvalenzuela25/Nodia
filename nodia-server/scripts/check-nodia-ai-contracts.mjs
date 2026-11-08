// Current successor: preserves common wire fixtures and checks source publication.
// The historical validator and its dated full-inventory assertions remain intact.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { defaultRoot, repositoryFile } from './nodia-ai-knowledge/compiler.mjs';
import frontmatter from './nodia-ai-knowledge/frontmatter.cjs';
import { verifyCommonContracts } from './nodia-ai-knowledge/common-contract-fixtures.mjs';
import { auditPublishedCatalog } from './check-nodia-ai-catalog.mjs';

try {
  if (process.argv.length !== 2) throw new Error('contracts_argument_invalid');
  const relative = 'docs/mvp/nodia-ai-v1-common-contracts.schema.json';
  const raw = fs.readFileSync(repositoryFile(defaultRoot, relative));
  const common = verifyCommonContracts(frontmatter.parseStrictJson(raw.toString('utf8')));
  const publication = await auditPublishedCatalog();
  console.log(JSON.stringify({
    task: 'nodia_ai_current_contracts', status: 'passed', mode: 'read_only',
    common_contracts: {
      definitions_compiled: common.definitions_compiled, fixture_assertions: common.fixture_assertions,
      positive_fixtures: common.positive_fixtures, negative_fixtures: common.negative_fixtures,
      schema_path: relative, sha256: createHash('sha256').update(raw).digest('hex'),
    },
    publication,
    scope: 'Common wire fixtures plus the current declared catalog/source-publication audit. No current API AST, deployed VM equality, handlers, SQL or provider acceptance.',
  }));
} catch (error) {
  const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'contracts_check_failed';
  console.error(JSON.stringify({ task: 'nodia_ai_current_contracts', status: 'failed', code }));
  process.exitCode = 1;
}
