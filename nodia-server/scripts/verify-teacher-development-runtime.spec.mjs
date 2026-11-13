import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTeacherDevelopmentArgs } from './verify-teacher-development-runtime.mjs';

const session = '11111111-1111-4111-8111-111111111111';
const auth = '22222222-2222-4222-8222-222222222222';
const job = '33333333-3333-4333-8333-333333333333';
const base = ['--development', `--session-id=${session}`, '--actor-id=1', `--auth-session-id=${auth}`, '--post-limit=8'];
test('requires explicit development, identity and a bounded budget before any operational work', () => {
  assert.equal(parseTeacherDevelopmentArgs([...base, '--stage=inspect']).stage, 'inspect');
  for (const missing of ['--development', `--session-id=${session}`, '--actor-id=1', `--auth-session-id=${auth}`, '--post-limit=8']) {
    assert.throws(() => parseTeacherDevelopmentArgs([...base.filter(item => item !== missing), '--stage=qualify-text']));
  }
  for (const limit of ['0', '13', 'Infinity', '1.5']) {
    assert.throws(() => parseTeacherDevelopmentArgs([...base.filter(item => !item.startsWith('--post-limit')), `--post-limit=${limit}`, '--stage=inspect']));
  }
});
test('rejects ambiguous flags, model/credential overrides, invalid identities and incompatible targets', () => {
  for (const extra of ['--development', '--model=dynamic', '--api-key=fixture', '--actor-id=2', '--stage=inspect']) {
    assert.throws(() => parseTeacherDevelopmentArgs([...base, '--stage=qualify-text', extra]));
  }
  assert.throws(() => parseTeacherDevelopmentArgs([...base.filter(item => !item.startsWith('--actor-id')), '--actor-id=9223372036854775808', '--stage=inspect']));
  assert.throws(() => parseTeacherDevelopmentArgs([...base, '--stage=qualify-text', `--job-id=${job}`]));
  assert.throws(() => parseTeacherDevelopmentArgs([...base, '--stage=run-job']));
  assert.throws(() => parseTeacherDevelopmentArgs([...base, '--stage=qualify-helper']));
});
test('separates fresh dispatch from completion of the original exact job', () => {
  for (const stage of ['run-job', 'complete-text', 'complete-helper']) {
    assert.equal(parseTeacherDevelopmentArgs([...base, `--stage=${stage}`, `--job-id=${job}`])['job-id'], job);
  }
  assert.equal(parseTeacherDevelopmentArgs([...base, '--stage=qualify-helper', `--thread-id=${job}`])['thread-id'], job);
  assert.throws(() => parseTeacherDevelopmentArgs([...base, '--stage=complete-helper', `--job-id=${job}`, `--thread-id=${job}`]));
});
