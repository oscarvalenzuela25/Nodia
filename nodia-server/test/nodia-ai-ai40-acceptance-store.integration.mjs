/** Linux private-file acceptance boundaries, no account, SQL or provider inference. */
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  lstat,
  chmod,
  rm,
  symlink,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CodexChatJournal } from '../dist/common/ai/codex/codex-chat-journal.js';
import {
  CodexChatAcceptanceStore,
  sameCodexMcpScope,
  codexChatRuntimeFingerprint,
} from '../dist/common/ai/codex/codex-chat-acceptance.js';

assert.equal(process.platform, 'linux');
const root = await mkdtemp(join(tmpdir(), 'nodia-ai40-accept-'));
const journal = new CodexChatJournal(root);
const store = new CodexChatAcceptanceStore(journal);
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
const file = join(root, '4', 'nodia-chat-mcp');
let result;
try {
  const identity = await journal.identity('4');
  const scope = {
    connectionId: '4',
    resourceKey: identity.resourceKey,
    sessionGeneration: identity.runtimeSessionId,
    configurationGeneration: 'c'.repeat(64),
    modelId: 'fixture-dynamic-model',
    effortId: 'fixture_effort',
    runtimeFingerprint: 'f'.repeat(64),
  };
  const acceptance = {
    version: 1,
    scope,
    verifiedAt: new Date().toISOString(),
    terminalProofId: randomUUID(),
    nonceSha256: 'a'.repeat(64),
  };
  check(
    'absent receipt never asserts acceptance',
    (await store.read('4')) === null,
  );
  await store.write(acceptance);
  check(
    'acceptance round-trips exact bounded receipt',
    JSON.stringify(await store.read('4')) === JSON.stringify(acceptance),
  );
  check(
    'private file and profile modes',
    ((await lstat(file)).mode & 0o777) === 0o600 &&
      ((await lstat(join(root, '4'))).mode & 0o777) === 0o700,
  );
  const childModule = new URL(
    '../dist/common/ai/codex/codex-chat-acceptance.js',
    import.meta.url,
  ).href;
  const journalModule = new URL(
    '../dist/common/ai/codex/codex-chat-journal.js',
    import.meta.url,
  ).href;
  const child = await promisify(execFile)(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import{CodexChatAcceptanceStore}from${JSON.stringify(childModule)};import{CodexChatJournal}from${JSON.stringify(journalModule)};const v=await new CodexChatAcceptanceStore(new CodexChatJournal(process.argv[1])).read('4');process.stdout.write(v?.terminalProofId??'absent')`,
      root,
    ],
    { env: { PATH: '/usr/bin:/bin' }, timeout: 10000, maxBuffer: 4096 },
  );
  check(
    'another process reads the same technical receipt',
    child.stdout === acceptance.terminalProofId,
  );
  const serialized = await readFile(file, 'utf8');
  check(
    'receipt contains no account content or request transcript',
    !serialized.includes('prompt') &&
      !serialized.includes('arguments') &&
      !serialized.includes('auth') &&
      Buffer.byteLength(serialized) < 4096,
  );
  await chmod(file, 0o644);
  await assert.rejects(store.read('4'));
  await chmod(file, 0o600);
  check('world-readable acceptance fails closed', true);
  const sentinel = join(root, 'sentinel');
  await writeFile(sentinel, serialized, { mode: 0o600 });
  await rm(file);
  await symlink(sentinel, file);
  await assert.rejects(store.read('4'));
  check(
    'symlink receipt fails closed without touching target',
    (await readFile(sentinel, 'utf8')) === serialized,
  );
  await rm(file);
  await store.write(acceptance);
  await writeFile(
    file,
    JSON.stringify({ ...acceptance, scope: { ...scope, connectionId: '5' } }),
  );
  await assert.rejects(store.read('4'));
  check('foreign connection receipt is rejected', true);
  await store.write(acceptance);
  await writeFile(file, JSON.stringify({ ...acceptance, verifiedAt: 0 }));
  await assert.rejects(store.read('4'));
  check('malformed metadata is never coerced into acceptance', true);
  await store.write(acceptance);
  const rotated = await journal.identity('4', true);
  check(
    'in-flight old acceptance is discarded after current marker rotation',
    (await store.read('4')) === null,
  );
  const newScope = { ...scope, sessionGeneration: rotated.runtimeSessionId };
  check(
    'login rotation changes logical identity and invalidates old scope',
    !sameCodexMcpScope(scope, newScope),
  );
  await store.write({ ...acceptance, scope: newScope });
  await store.invalidate(scope);
  check(
    'stale invalidation cannot erase another session acceptance',
    (await store.read('4')).scope.sessionGeneration ===
      rotated.runtimeSessionId,
  );
  await store.invalidate(newScope);
  check(
    'matching uncertain operation removes only its acceptance',
    (await store.read('4')) === null,
  );
  check(
    'acceptance does not create or mutate runtime proof records',
    (await readdir(await journal.root())).every(
      (name) => !name.endsWith('.json'),
    ),
  );
  const nativeFixture = join(root, 'native-fixture');
  await writeFile(nativeFixture, 'isolated-synthetic-native-v1', {
    mode: 0o700,
  });
  const before = await codexChatRuntimeFingerprint(nativeFixture);
  await writeFile(nativeFixture, 'isolated-synthetic-native-v2');
  const after = await codexChatRuntimeFingerprint(nativeFixture);
  check(
    'native executable bytes invalidate runtime fingerprint',
    before !== after && /^[a-f0-9]{64}$/.test(after),
  );
  const files = await readdir(join(root, '4'));
  check(
    'atomic writes leave no temporary acceptance files',
    files.every((name) => !name.endsWith('.tmp')),
  );
  result = {
    task: 'AI-40',
    scope: 'isolated_private_acceptance_store',
    status: 'passed',
    checks,
    real_account: false,
    provider_dispatches: 0,
    operational_profiles_modified: false,
  };
} finally {
  assert.ok(
    resolve(root).startsWith(resolve(tmpdir()) + '/nodia-ai40-accept-'),
  );
  await rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify(result));
