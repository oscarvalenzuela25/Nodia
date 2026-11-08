// Narrow integration: actual compiled schema compiler, no Nest application/DB.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileNodiaAiToolSchema } from '../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { assertNoAdministrativeModuleFields } from '../scripts/nodia-ai-knowledge/catalog-audit.mjs';

function compile(root) {
  const sourceJson = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://synthetic.invalid/catalog-runtime-test', $defs: { Root: root } });
  return compileNodiaAiToolSchema({ sourceJson, sha256: createHash('sha256').update(sourceJson).digest('hex'), definition: 'Root' });
}

for (const additionalProperties of [true, {}]) {
  it(`runtime compiler rejects an open root: ${JSON.stringify(additionalProperties)}`, () => {
    assert.throws(() => compile({ type: 'object', properties: {}, additionalProperties }), /tool_registry_invalid/);
  });
  it(`runtime compiler rejects an open nested object: ${JSON.stringify(additionalProperties)}`, () => {
    assert.throws(() => compile({ type: 'object', additionalProperties: false, properties: { child: { type: 'object', properties: {}, additionalProperties } } }), /tool_registry_invalid/);
  });
}

it('actual closed compiler admits a matching pattern; Core metadata guard independently rejects it', () => {
  const compiled = compile({ type: 'object', additionalProperties: false, patternProperties: { '^sort_order$': { type: 'integer' } } });
  assert.equal(compiled.validate({ sort_order: 1 }), true);
  assert.throws(() => assertNoAdministrativeModuleFields('nodia_modules_get', compiled.schema), /administrative_module_field_published/);
  assert.doesNotThrow(() => assertNoAdministrativeModuleFields('nodia_other_get', compiled.schema));
});
