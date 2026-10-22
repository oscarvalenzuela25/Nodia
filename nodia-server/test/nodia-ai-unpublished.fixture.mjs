// Explicit empty publication regression. Independent from whichever real release is installed.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { loadAi } from './nodia-ai.integration.fixture.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
    : JSON.stringify(value);

export async function createNodiaAiUnpublishedFixture() {
  const root = mkdtempSync(join(tmpdir(), 'nodia-ai-empty-publication-'));
  const schema = readFileSync(new URL('../scripts/nodia-ai-knowledge/contracts.schema.json', import.meta.url));
  const payload = {
    schema_version:1, registry_sha256:hash('synthetic empty regression only'),
    contract_schema_sha256:hash(schema), catalog_release:'synthetic-empty/1',
    context_module_route:'/tools/nodia-ai', documents:[], fragments:[], capability_contracts:[],
  };
  const manifest = { ...payload, release_id:hash(canonical(payload)) };
  writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest));
  const pin = { schema_version:1, release_id:manifest.release_id,
    catalog_release:manifest.catalog_release, schema_sha256:hash(schema) };
  const contextTokens = await import('../dist/nodia-ai-context/types/knowledge.types.js');
  const toolTokens = await import('../dist/nodia-ai-tools/types/tool-registry.types.js');
  const RegistryModule = await loadAi('nodia-ai-tools/nodia-ai-tool-registry.module','NodiaAiToolRegistryModule');
  const ProductReads = await loadAi('nodia-ai-products/nodia-ai-product-reads.module','NodiaAiProductReadsModule');
  const actual = Reflect.getMetadata('imports',RegistryModule).find(value => value?.module === ProductReads);
  if (!actual) throw new Error('Missing explicit product composition');
  return {
    override(builder) {
      builder.overrideModule(actual).useModule(ProductReads.forPublication([]));
      builder.overrideProvider(contextTokens.NODIA_AI_KNOWLEDGE_ROOT).useValue(root);
      builder.overrideProvider(contextTokens.NODIA_AI_KNOWLEDGE_PIN).useValue(pin);
      builder.overrideProvider(contextTokens.NODIA_AI_KNOWLEDGE_SCHEMA).useValue(schema);
      builder.overrideProvider(toolTokens.NODIA_AI_CAPABILITIES_CATALOG_VERSION).useValue(manifest.catalog_release);
      return builder;
    },
    close() {
      const absolute = realpathSync(root);
      if(!absolute.startsWith(`${resolve(tmpdir())}${sep}nodia-ai-empty-publication-`)) throw new Error('Unsafe fixture path');
      rmSync(absolute,{recursive:true,force:true});
    },
  };
}
