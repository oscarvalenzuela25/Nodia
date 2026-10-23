/** Isolated Linux storage checks. No app bootstrap, auth, provider or inference. */
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  lstat,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CodexChatJournal } from '../dist/common/ai/codex/codex-chat-journal.js';

if (process.platform !== 'linux')
  throw new Error('Linux ownership and flock required');
const sandbox = await mkdtemp(join(tmpdir(), 'nodia-ai39-journal-'));
const checked = resolve(sandbox);
if (!relative(resolve(tmpdir()), checked).startsWith('nodia-ai39-journal-'))
  throw new Error('Unexpected cleanup root');
const root = join(sandbox, 'private-profile-root');
const journal = new CodexChatJournal(root);
let checks = 0;
const check = (value) => {
  assert.ok(value);
  checks++;
};
const certificate = {
  pid: 2222,
  group: 2222,
  birth: '1234',
  boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};
const record = (connectionId, state, acknowledged, expired) => {
  const attemptId = randomUUID();
  return {
    version: 1,
    identity: {
      engine: 'agentic',
      attemptId,
      operationRef: attemptId,
      resourceKey: `codex-profile:${connectionId.padStart(64, '0')}`,
      sessionGeneration: 'b'.repeat(32),
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId,
      },
    },
    expiresAt: new Date(Date.now() + (expired ? -10000 : 60000)).toISOString(),
    owner: certificate,
    native: certificate,
    state,
    payloadSha256: 'd'.repeat(64),
    rpcCount: 2,
    frames: 10,
    bytes: 1000,
    unforwardedRequests: 0,
    cancelRequested: false,
    terminalProofId: ['completed', 'abandoned_unknown'].includes(state)
      ? randomUUID()
      : null,
    observedAt: ['completed', 'abandoned_unknown'].includes(state)
      ? new Date().toISOString()
      : null,
    acknowledged,
  };
};
try {
  const first = await journal.identity('4');
  check(/^[a-f0-9]{32}$/.test(first.runtimeSessionId));
  check(/^codex-profile:[a-f0-9]{64}$/.test(first.resourceKey));
  const otherProcessView = await new CodexChatJournal(root).identity('4');
  check(JSON.stringify(first) === JSON.stringify(otherProcessView));
  const otherConnection = await journal.identity('5');
  const rotated = await journal.identity('4', true);
  check(
    rotated.resourceKey === first.resourceKey &&
      rotated.runtimeSessionId !== first.runtimeSessionId,
  );
  check(
    (await journal.identity('5')).runtimeSessionId ===
      otherConnection.runtimeSessionId,
  );
  check(!(await readdir(join(root, '4'))).includes('auth.json'));
  const expiredAck = record('4', 'completed', true, true);
  const expiredUnknown = record('5', 'abandoned_unknown', false, true);
  const expiredActive = record('6', 'submitted', false, true);
  const futureAck = record('7', 'completed', true, false);
  for (const value of [expiredAck, expiredUnknown, expiredActive, futureAck]) {
    await journal.locked(value.identity.attemptId, () =>
      journal.write(value, true),
    );
  }
  await journal.prune();
  check((await journal.read(expiredAck.identity.attemptId)) === null);
  check(
    (await journal.read(expiredUnknown.identity.attemptId)).state ===
      'abandoned_unknown',
  );
  check(
    (await journal.read(expiredActive.identity.attemptId)).state ===
      'submitted',
  );
  check(
    (await journal.read(futureAck.identity.attemptId)).acknowledged === true,
  );
  const names = await readdir(await journal.root());
  check(!names.includes(`${expiredAck.identity.attemptId}.json.guard`));
  const stat = await lstat(
    join(await journal.root(), `${expiredUnknown.identity.attemptId}.json`),
  );
  check((stat.mode & 0o777) === 0o600 && stat.uid === process.getuid());
  await assert.rejects(journal.assertNoPending('5'));
  checks++;
  await journal.assertNoPending('4');
  checks++;
  const target = join(sandbox, 'synthetic-private-neighbor');
  await writeFile(target, 'synthetic-neighbor', { mode: 0o600 });
  const malicious = randomUUID();
  await symlink(target, join(await journal.root(), `${malicious}.json`));
  await assert.rejects(journal.read(malicious));
  checks++;
  check((await lstat(target)).size === 18);
  console.log(
    JSON.stringify({
      status: 'passed',
      checks,
      scope: 'Linux private journal only',
      accountCalls: 0,
      nativeGenerations: 0,
      businessEffects: 0,
      syntheticCertificates: true,
    }),
  );
} finally {
  await rm(checked, { recursive: true, force: true });
}
