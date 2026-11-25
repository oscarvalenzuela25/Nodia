import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFlashcardImageQualificationArgs } from '../scripts/teacher-flashcard-image-qualification-args.mjs';

const identity = [
  '--user-id=7',
  '--auth-session-public-id=11111111-1111-4111-8111-111111111111',
  '--connection-id=3',
  '--model-id=synthetic-discovered-model',
];
const operation = '22222222-2222-4222-8222-222222222222';

test('requires an exact selected API identity and an explicit, single action', () => {
  const result = parseFlashcardImageQualificationArgs([
    ...identity,
    '--probe-request-key=' + operation,
  ]);
  assert.equal(result.action, 'probe');
  assert.equal(result.operation, operation);
  assert.deepEqual(result.selection, {
    connection_id: '3',
    mode: 'api_key',
    model_id: 'synthetic-discovered-model',
    effort_id: null,
  });
  assert.equal(
    parseFlashcardImageQualificationArgs([
      ...identity,
      '--accept-operation-id=' + operation,
    ]).action,
    'accept',
  );
  assert.equal(
    parseFlashcardImageQualificationArgs([
      ...identity,
      '--inspect-operation-id=' + operation,
    ]).action,
    'inspect',
  );
  for (const inputs of [
    identity,
    [
      ...identity,
      '--probe-request-key=' + operation,
      '--accept-operation-id=' + operation,
    ],
    [...identity, '--probe-request-key=' + operation, '--prompt=untrusted'],
    [...identity, '--probe-request-key=unknown'],
    [
      ...identity.slice(0, 2),
      '--connection-id=9223372036854775808',
      identity[3],
      '--probe-request-key=' + operation,
    ],
  ])
    assert.throws(
      () => parseFlashcardImageQualificationArgs(inputs),
      /invalid qualification arguments/,
    );
});
