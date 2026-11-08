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
  link,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CodexChatJournal } from '../dist/common/ai/codex/codex-chat-journal.js';
import {
  CodexChatAcceptanceStore,
  sameCodexMcpScope,
  codexChatRuntimeFingerprint,
} from '../dist/common/ai/codex/codex-chat-acceptance.js';

import { CodexChatImageAcceptanceStore } from '../dist/common/ai/codex/codex-chat-image-acceptance.js';
import {
  cleanupCodexChatImages,
  decodeCodexChatImages,
  stageCodexChatImages,
} from '../dist/common/ai/codex/codex-chat-images.js';

assert.equal(process.platform, 'linux');
const root = await mkdtemp(join(tmpdir(), 'nodia-ai40-accept-'));
const journal = new CodexChatJournal(root);
const store = new CodexChatAcceptanceStore(journal);
const checks = [];
const imageChecks = [];
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
  // Extend the existing POSIX boundary harness; the sixteen MCP checks above
  // retain their original names and assertions. No native process is started.
  const imageCheck = (name, condition) => {
    assert.ok(condition, name);
    imageChecks.push(name);
  };
  const pngStore = new CodexChatImageAcceptanceStore('image/png', journal);
  const jpegStore = new CodexChatImageAcceptanceStore('image/jpeg', journal);
  const pngProof = { ...acceptance, scope: newScope, mediaType: 'image/png' };
  const pngReceipt = `${file}-image-png`;
  imageCheck('MCP receipt does not certify any image MIME',
    (await pngStore.read('4')) === null && (await jpegStore.read('4')) === null);
  await assert.rejects(pngStore.write({ ...acceptance, scope: newScope }));
  await pngStore.write(pngProof);
  imageCheck('exact PNG proof round-trips independently of JPEG and MCP',
    JSON.stringify(await pngStore.read('4')) === JSON.stringify(pngProof) &&
      (await jpegStore.read('4')) === null && (await store.read('4')) === null);
  imageCheck('image proof has private POSIX mode and bounded metadata only',
    ((await lstat(pngReceipt)).mode & 0o777) === 0o600 &&
      Buffer.byteLength(await readFile(pngReceipt)) < 4096 &&
      !(await readFile(pngReceipt, 'utf8')).includes('contentBase64'));
  await jpegStore.write({ ...pngProof, mediaType: 'image/jpeg' });
  await pngStore.invalidate(newScope);
  imageCheck('invalidating PNG preserves an independently accepted JPEG MIME',
    (await pngStore.read('4')) === null &&
      (await jpegStore.read('4')).mediaType === 'image/jpeg');
  await pngStore.write(pngProof);
  const pngSerialized = await readFile(pngReceipt);
  const imageSentinel = join(root, 'image-proof-sentinel');
  await writeFile(imageSentinel, pngSerialized, { mode: 0o600 });
  await rm(pngReceipt);
  await symlink(imageSentinel, pngReceipt);
  await assert.rejects(pngStore.read('4'));
  imageCheck('symlink image proof fails closed without touching target',
    (await readFile(imageSentinel)).equals(pngSerialized));
  await rm(pngReceipt);
  await pngStore.write(pngProof);
  const proofAlias = join(root, 'image-proof-alias');
  await link(pngReceipt, proofAlias);
  await assert.rejects(pngStore.read('4'));
  imageCheck('hardlinked image proof fails closed without modifying either alias',
    (await lstat(pngReceipt)).nlink === 2 &&
      (await readFile(proofAlias)).equals(pngSerialized));
  await rm(proofAlias);
  await chmod(pngReceipt, 0o644);
  await assert.rejects(pngStore.read('4'));
  await chmod(pngReceipt, 0o600);
  imageCheck('world-readable image proof fails closed and remains recoverable',
    (await pngStore.read('4')).mediaType === 'image/png');

  const onePixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  const decoded = decodeCodexChatImages([{
    mediaType: 'image/png',
    sha256: createHash('sha256').update(onePixel).digest('hex'),
    contentBase64: onePixel.toString('base64'),
  }], { fileBytes: 20 * 1024 * 1024, totalBytes: 40 * 1024 * 1024, count: 4, pixels: 12_000_000 });
  const attempt = () => {
    const id = randomUUID();
    return {
      engine: 'agentic', attemptId: id, operationRef: id,
      adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '4' },
      resourceKey: rotated.resourceKey, sessionGeneration: rotated.runtimeSessionId,
    };
  };
  const firstAttempt = attempt(), secondAttempt = attempt();
  const signal = new AbortController().signal;
  const [firstPath] = await stageCodexChatImages(journal, firstAttempt, decoded, signal);
  const [secondPath] = await stageCodexChatImages(journal, secondAttempt, decoded, signal);
  const imageRoot = join(root, '4', 'nodia-chat-images');
  imageCheck('attempt-derived image paths contain exact decoded bytes without sharing ownership',
    firstPath === join(imageRoot, firstAttempt.attemptId, '0.png') &&
      secondPath === join(imageRoot, secondAttempt.attemptId, '0.png') &&
      firstPath !== secondPath && (await readFile(firstPath)).equals(onePixel) &&
      (await readFile(secondPath)).equals(onePixel));
  imageCheck('staging root and attempt are private and files have single ownership',
    ((await lstat(imageRoot)).mode & 0o777) === 0o700 &&
      ((await lstat(join(imageRoot, firstAttempt.attemptId))).mode & 0o777) === 0o700 &&
      ((await lstat(firstPath)).mode & 0o777) === 0o600 &&
      (await lstat(firstPath)).uid === process.getuid() &&
      (await lstat(firstPath)).nlink === 1);
  await assert.rejects(stageCodexChatImages(journal, firstAttempt, decoded, signal));
  imageCheck('a repeated staging call cannot overwrite an already owned attempt',
    (await readFile(firstPath)).equals(onePixel));

  const badSibling = join(imageRoot, firstAttempt.attemptId, '1.png');
  await symlink(secondPath, badSibling);
  await assert.rejects(cleanupCodexChatImages(journal, firstAttempt));
  imageCheck('cleanup rejects a symlink before deleting any valid sibling',
    (await readFile(firstPath)).equals(onePixel) &&
      (await readFile(secondPath)).equals(onePixel) && (await lstat(badSibling)).isSymbolicLink());
  await rm(badSibling);
  await link(secondPath, badSibling);
  await assert.rejects(cleanupCodexChatImages(journal, firstAttempt));
  imageCheck('cleanup rejects a hardlink before deleting a valid sibling or another attempt',
    (await readFile(firstPath)).equals(onePixel) &&
      (await lstat(secondPath)).nlink === 2);
  await rm(badSibling);
  await chmod(firstPath, 0o644);
  await assert.rejects(cleanupCodexChatImages(journal, firstAttempt));
  await chmod(firstPath, 0o600);
  imageCheck('cleanup rejects public image permissions without deleting staged content',
    (await readFile(firstPath)).equals(onePixel));
  await assert.rejects(cleanupCodexChatImages(journal, { ...firstAttempt, attemptId: '../escape' }));
  imageCheck('cleanup refuses an attempt path outside the validated UUID identity',
    (await readFile(firstPath)).equals(onePixel));

  // A getter only schedules cancellation at the second decoded input. Disk I/O,
  // ownership validation, exclusive writes and cleanup remain the real helpers.
  const partialAttempt = attempt(), cancellation = new AbortController();
  const partialInputs = [decoded[0], decoded[0]];
  Object.defineProperty(partialInputs, '1', { get() {
    cancellation.abort(new Error('synthetic second-image cancellation'));
    return decoded[0];
  } });
  await assert.rejects(stageCodexChatImages(journal, partialAttempt, partialInputs, cancellation.signal));
  const partialPath = join(imageRoot, partialAttempt.attemptId, '0.png');
  imageCheck('partial staging survives cancellation until explicit native-closure cleanup',
    (await readFile(partialPath)).equals(onePixel) &&
      (await readdir(join(imageRoot, partialAttempt.attemptId))).join(',') === '0.png');
  // This isolated harness owns no native child, so the caller's closure condition
  // is trivially known. The storage helper itself must not claim that guarantee.
  await cleanupCodexChatImages(journal, partialAttempt);
  await cleanupCodexChatImages(journal, partialAttempt);
  imageCheck('explicit cleanup is idempotent and preserves other owned attempts',
    !(await readdir(imageRoot)).includes(partialAttempt.attemptId) &&
      (await readFile(firstPath)).equals(onePixel) && (await readFile(secondPath)).equals(onePixel));

  const nextIdentity = await journal.identity('4', true);
  imageCheck('session rotation invalidates every previous MIME proof independently',
    (await pngStore.read('4')) === null && (await jpegStore.read('4')) === null);
  await assert.rejects(stageCodexChatImages(journal, attempt(), decoded, signal));
  imageCheck('session rotation blocks staging under a stale attempt identity',
    (await readFile(firstPath)).equals(onePixel));
  await cleanupCodexChatImages(journal, firstAttempt);
  await cleanupCodexChatImages(journal, firstAttempt);
  imageCheck('closed old-session cleanup does not erase another attempt after rotation',
    !(await readdir(imageRoot)).includes(firstAttempt.attemptId) &&
      (await readFile(secondPath)).equals(onePixel));
  const nextScope = { ...newScope, sessionGeneration: nextIdentity.runtimeSessionId };
  await pngStore.write({ ...pngProof, scope: nextScope });
  await pngStore.invalidate(newScope);
  imageCheck('stale PNG invalidation cannot erase a newer session proof',
    (await pngStore.read('4')).scope.sessionGeneration === nextIdentity.runtimeSessionId);
  await cleanupCodexChatImages(journal, secondAttempt);
  imageCheck('final image cleanup leaves profiles and acceptance metadata intact',
    (await readdir(imageRoot)).length === 0 &&
      (await pngStore.read('4')).mediaType === 'image/png' &&
      (await lstat(join(root, '4'))).isDirectory());
  const foreignProfile = await journal.identity('5');
  const foreignId = randomUUID();
  const foreignAttempt = {
    ...firstAttempt, attemptId: foreignId, operationRef: foreignId,
    adapterIdentity: { ...firstAttempt.adapterIdentity, connectionId: '5' },
    resourceKey: foreignProfile.resourceKey, sessionGeneration: foreignProfile.runtimeSessionId,
  };
  const foreignRoot = join(root, '5', 'nodia-chat-images');
  await symlink(imageRoot, foreignRoot);
  await assert.rejects(stageCodexChatImages(journal, foreignAttempt, decoded, signal));
  await assert.rejects(cleanupCodexChatImages(journal, foreignAttempt));
  imageCheck('staging and cleanup reject a symlink root without traversing another profile',
    (await lstat(foreignRoot)).isSymbolicLink() && (await readdir(imageRoot)).length === 0 &&
      (await pngStore.read('4')).scope.sessionGeneration === nextIdentity.runtimeSessionId);
  await rm(foreignRoot);
  result = {
    task: 'AI-40',
    scope: 'isolated_private_acceptance_store',
    status: 'passed',
    checks,
    image_checks: imageChecks,
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
