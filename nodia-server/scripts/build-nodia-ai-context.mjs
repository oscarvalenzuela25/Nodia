import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Deployment-owned pin is packaged separately from the untrusted content bundle.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prepare = process.argv.includes('--prepare');
if (process.argv.slice(2).some((arg) => arg !== '--prepare'))
  throw new Error('invalid_build_argument');
const bundle = path.join(root, 'dist/nodia-ai/knowledge');
const manifest = JSON.parse(
  fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'),
);
const schema = fs.readFileSync(
  path.join(root, 'scripts/nodia-ai-knowledge/contracts.schema.json'),
);
if (
  !/^[a-f0-9]{64}$/.test(manifest.release_id) ||
  createHash('sha256').update(schema).digest('hex') !==
    manifest.contract_schema_sha256
)
  throw new Error('nodia_ai_context_build_mismatch');
const target = path.join(
  root,
  prepare ? 'src' : 'dist',
  'nodia-ai-context/config',
);
// The shared coordination schema is a build-owned asset, not a second editable contract.
const commonSchema = fs.readFileSync(path.join(root, '../docs/mvp/nodia-ai-v1-common-contracts.schema.json'));
const common = JSON.parse(commonSchema.toString('utf8'));
if (common.$schema !== 'https://json-schema.org/draft/2020-12/schema' || typeof common.$id !== 'string')
  throw new Error('nodia_ai_common_contract_build_mismatch');
const toolConfig = path.join(root, prepare ? 'src' : 'dist', 'nodia-ai-tools/config');
fs.mkdirSync(toolConfig, { recursive: true });
fs.writeFileSync(path.join(toolConfig, 'common-schema.json'), commonSchema);
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, 'knowledge-schema.json'), schema);
fs.writeFileSync(
  path.join(target, 'knowledge-pin.json'),
  JSON.stringify({
    schema_version: 1,
    release_id: manifest.release_id,
    catalog_release: manifest.catalog_release,
    schema_sha256: manifest.contract_schema_sha256,
  }),
);
if (prepare)
  fs.cpSync(bundle, path.join(root, 'src/nodia-ai/knowledge'), {
    recursive: true,
  });
console.log(
  JSON.stringify({
    task: 'AI-12',
    release: manifest.release_id,
    published_documents: manifest.documents.length,
    published_fragments: manifest.fragments.length,
  }),
);
