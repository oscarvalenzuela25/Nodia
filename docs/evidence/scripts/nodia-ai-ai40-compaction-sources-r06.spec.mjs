import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compactionSources, verifyCompactionSources, verifyCompactionSummary } from './nodia-ai-ai40-compaction-sources-r06.mjs';

const code = '0123456789ABCDEF0123456789ABCDEF';
const policy = JSON.parse(await readFile(new URL('../../mvp/nodia-ai-v1-runtime-policy.json', import.meta.url), 'utf8'));

test('six own synthetic user sources trigger the unchanged policy and fit its loader window without leaking the oracle into requests', () => {
  const result = verifyCompactionSources(compactionSources(code), code, policy);
  assert.equal(result.source_text_utf8_bytes, 159744);
  assert.equal(result.threshold_utf8_bytes, 131072);
  assert.equal(result.history_load_window_utf8_bytes, 196608);
  assert.equal(result.assembly_ceiling_utf8_bytes, 262144);
  assert.equal(result.synthetic_assistant_messages_seeded, 0);
});

test('literal summary must cover every source and preserve independent code and house facts', () => {
  const history = compactionSources(code);
  const summary = { schema_version: 1, facts: history.map(item => ({ text: item.parts[0].text.split('.')[0] + '.', source_seqs: [item.seq] })), decisions: [], questions: [], entities: [], requirements: [] };
  assert.equal(verifyCompactionSummary(summary, history, code).citation_count, 6);
  for (const mutate of [s => s.facts.pop(), s => { s.facts[0].source_seqs = ['2']; }, s => { s.facts[0].text = 'Invented fact'; }, s => { s.facts[0].text = 'Texto sintetico'; }, s => { s.facts[1].text = 'Texto sintetico'; }]) {
    const changed = structuredClone(summary); mutate(changed);
    assert.throws(() => verifyCompactionSummary(changed, history, code));
  }
});
