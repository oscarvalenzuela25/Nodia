import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyCommonContracts } from '../scripts/nodia-ai-knowledge/common-contract-fixtures.mjs';

const read = () => JSON.parse(fs.readFileSync(new URL('../../docs/mvp/nodia-ai-v1-common-contracts.schema.json', import.meta.url), 'utf8'));

it('runs every current definition and all retained named wire fixtures', () => {
  const schema = read(); const result = verifyCommonContracts(schema);
  assert.equal(result.definitions_compiled, Object.keys(schema.$defs).length);
  assert.equal(result.fixtures.filter(item => item.label === 'minimal structural fixture').length, Object.keys(schema.$defs).length);
  assert(result.fixtures.some(item => item.schema === 'ConversationUpdateRequest' && item.label === 'metadata cannot transfer chat ownership' && item.expectedValid === false));
  assert(result.positive_fixtures > 0 && result.negative_fixtures > 0);
});

it('fails if the current wire schema starts allowing an owner override', () => {
  const schema = read();
  schema.$defs.ConversationUpdateRequest.properties.owner_user_id = { type: 'string' };
  assert.throws(() => verifyCommonContracts(schema), /metadata cannot transfer chat ownership/);
});

it('compiles new definitions without fixing the old definition count', () => {
  const schema = read();
  schema.$defs.SyntheticSuccessor = { type: 'object', additionalProperties: false, required: ['enabled'], properties: { enabled: { type: 'boolean' } } };
  const result = verifyCommonContracts(schema);
  assert.equal(result.definitions_compiled, Object.keys(schema.$defs).length);
  assert(result.fixtures.some(item => item.schema === 'SyntheticSuccessor' && item.expectedValid));
});
