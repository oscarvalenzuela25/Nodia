import assert from 'node:assert/strict';
import test from 'node:test';
import { checkResults } from './check-results.mjs';

function results(flags = {}) {
  return {
    changes: { result: 'success', outputs: {
      client: 'false', server: 'false', python: 'false', native: 'false', contracts: 'false',
      docs: 'true', ci: 'false', docs_only: 'true', ...flags,
    } },
    client: { result: flags.client === 'true' ? 'success' : 'skipped' },
    server: { result: flags.server === 'true' || flags.contracts === 'true' ? 'success' : 'skipped' },
    python: { result: flags.python === 'true' ? 'success' : 'skipped' },
    native: { result: flags.native === 'true' ? 'success' : 'skipped' },
  };
}

test('documentation-only CI succeeds without requiring unrelated builds', () => {
  assert.equal(checkResults(results()).status, 'passed');
});

test('a frontend-only change requires its build while allowing the other jobs to skip', () => {
  const state = results({ client: 'true', docs_only: 'false' });
  assert.equal(checkResults(state).selected.client, true);
  state.client.result = 'skipped';
  assert.throws(() => checkResults(state), /client must be success/);
});

test('contract changes cannot silently bypass the backend verification', () => {
  const state = results({ contracts: 'true', docs_only: 'false' });
  assert.equal(checkResults(state).selected.server, true);
  state.server.result = 'skipped';
  assert.throws(() => checkResults(state), /server must be success/);
});

test('failed, cancelled or incomplete selection never passes the required check', () => {
  for (const result of ['failure', 'cancelled', 'skipped']) {
    const state = results();
    state.changes.result = result;
    assert.throws(() => checkResults(state), /selection did not succeed/);
  }
  const state = results();
  delete state.native;
  assert.throws(() => checkResults(state), /incomplete/);
});

test('failed or cancelled selected checks cannot be hidden by always()', () => {
  for (const result of ['failure', 'cancelled', 'skipped']) {
    const state = results({ server: 'true', python: 'true', native: 'true' });
    state.native.result = result;
    assert.throws(() => checkResults(state), /native must be success/);
  }
});

test('missing or malformed boolean outputs cannot justify skipping all builds', () => {
  for (const value of [undefined, '', 'False', false, true, 'false\nclient=false']) {
    const state = results();
    state.changes.outputs.client = value;
    assert.throws(() => checkResults(state), /outputs are invalid/);
  }
});
