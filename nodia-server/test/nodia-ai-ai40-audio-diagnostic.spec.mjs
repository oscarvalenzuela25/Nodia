import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instrumentCodexAudioRuntime, audioReplyDiagnostic, safeCodexCanaryError } from './nodia-ai-ai40-audio-diagnostic.mjs';

const normalize = value => value.toLowerCase();
const expected = 'Faro sintético unidad cuatro';
const request = () => ({ identity: { attemptId: 'synthetic-attempt' },
  audio: [{ mediaType: 'audio/wav', sha256: 'a'.repeat(64) }] });
const options = { expectedTranscript: expected, normalize, expectedAudioSha: 'a'.repeat(64) };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('delegates once with identical receiver, arguments, Promise and result, then restores', async () => {
  const input = request(), callbacks = { onPrepared() {} }, before = JSON.stringify(input);
  const reply = { text: expected, terminalProof: { terminalProofId: 'synthetic-proof', outcome: 'completed' } };
  const promise = Promise.resolve(reply); let calls = 0;
  const runtime = { execute(...args) { calls++; assert.equal(this, runtime); assert.equal(args[0], input);
    assert.equal(args[1], callbacks); return promise; } };
  const original = runtime.execute, installed = instrumentCodexAudioRuntime(runtime, options);
  assert.equal(runtime.execute(input, callbacks), promise);
  assert.equal(await promise, reply); await flush(); assert.equal(calls, 1);
  assert.equal(JSON.stringify(input), before); assert.equal(installed.observation.exact_oracle_match, true);
  assert.equal(installed.observation.response_category, 'exact_transcript');
  assert.equal(installed.observation.original_promise_returned, true);
  assert.equal(JSON.stringify(installed.observation).includes(expected), false);
  assert.throws(() => runtime.execute(input, callbacks), /operator_audio_duplicate_execute/u);
  assert.equal(calls, 1); installed.restore(); assert.equal(runtime.execute, original);
});
test('preserves rejection identity and exposes only the closed technical code', async () => {
  const error = Object.assign(new Error('private detail'), { code: 'audio_probe_unverified', outcome: 'unknown' });
  const promise = Promise.reject(error), runtime = { execute: () => promise };
  const installed = instrumentCodexAudioRuntime(runtime, options);
  assert.equal(runtime.execute(request(), {}), promise);
  await assert.rejects(promise, actual => actual === error); await flush();
  assert.equal(installed.observation.runtime_error.code, 'audio_probe_unverified');
  assert.equal(installed.observation.original_error_preserved, true);
  assert.equal(JSON.stringify(installed.observation).includes('private detail'), false); installed.restore();
});
test('diagnostic getters and synchronous errors cannot replace the original error', () => {
  const error = Object.create(null, { name: { get() { throw Error('private getter'); } } });
  const runtime = { execute() { throw error; } }, installed = instrumentCodexAudioRuntime(runtime, options);
  assert.throws(() => runtime.execute(request(), {}), actual => actual === error);
  assert.deepEqual(installed.observation.runtime_error, { name: 'Error', code: null, outcome: null }); installed.restore();
});
test('a failed observation branch preserves the original fulfilled Promise and result', async () => {
  const reply = { text: expected }, promise = Promise.resolve(reply), runtime = { execute: () => promise };
  const installed = instrumentCodexAudioRuntime(runtime, { ...options, normalize() { throw Error('private projection'); } });
  assert.equal(runtime.execute(request(), {}), promise); assert.equal(await promise, reply); await flush();
  assert.equal(installed.observation.projection_error, 'reply_projection_failed'); installed.restore();
});
test('classifies explicit refusal wording without treating an unclassified mismatch as ASR or support proof', () => {
  assert.equal(audioReplyDiagnostic('cannot hear the audio', expected, normalize).response_category, 'explicit_audio_refusal_phrase');
  assert.equal(audioReplyDiagnostic('No puedo escuchar este audio', expected, normalize).response_category, 'explicit_audio_refusal_phrase');
  assert.equal(audioReplyDiagnostic('different spoken words', expected, normalize).response_category, 'transcript_mismatch_unclassified');
  assert.equal(audioReplyDiagnostic('cannot hear the audio', 'cannot hear the audio', normalize).response_category, 'exact_transcript');
  assert.equal(safeCodexCanaryError(Object.assign(new Error('secret'), { code: 'unknown_private_text' })).code, null);
});
test('restores an inherited method without leaving a shadow property', () => {
  const prototype = { execute() { return Promise.resolve({}); } }, runtime = Object.create(prototype);
  const installed = instrumentCodexAudioRuntime(runtime, options);
  assert.equal(Object.hasOwn(runtime, 'execute'), true); installed.restore();
  assert.equal(Object.hasOwn(runtime, 'execute'), false); assert.equal(runtime.execute, prototype.execute);
});
