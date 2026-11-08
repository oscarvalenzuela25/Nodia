import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertKnowledgeRuntimePin } from '../scripts/check-nodia-ai-knowledge.mjs';

const manifest = { release_id: 'a'.repeat(64), catalog_release: 'synthetic/1' };
const schemaHash = 'b'.repeat(64);
const pin = { schema_version: 1, release_id: manifest.release_id, catalog_release: manifest.catalog_release, schema_sha256: schemaHash };

test('accepts exactly the current source publication and schema pin independent of key ordering', () => {
  assert.doesNotThrow(() => assertKnowledgeRuntimePin({ schema_sha256: schemaHash, ...pin }, manifest, schemaHash));
});
for (const field of ['schema_version', 'release_id', 'catalog_release', 'schema_sha256']) {
  test(`rejects stale or missing runtime ${field}`, () => {
    assert.throws(() => assertKnowledgeRuntimePin({ ...pin, [field]: field === 'schema_version' ? 2 : 'obsolete' }, manifest, schemaHash), /knowledge_runtime_pin_mismatch/);
    const incomplete = { ...pin }; delete incomplete[field];
    assert.throws(() => assertKnowledgeRuntimePin(incomplete, manifest, schemaHash), /knowledge_runtime_pin_mismatch/);
  });
}
test('rejects extra runtime authority fields instead of widening the pin contract', () => {
  assert.throws(() => assertKnowledgeRuntimePin({ ...pin, approved: true }, manifest, schemaHash), /knowledge_runtime_pin_mismatch/);
});
