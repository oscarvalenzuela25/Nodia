import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inventory, normalizeProductionModes, safeRelative, verifySource } from '../package-backend-release.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const temporaryRoot = process.env.NODIA_PACKAGE_TEST_TEMP_ROOT
  ? path.resolve(process.env.NODIA_PACKAGE_TEST_TEMP_ROOT)
  : path.resolve(fileURLToPath(new URL('../../../', import.meta.url)), '.tmp/production/package-tests');
fs.mkdirSync(temporaryRoot, { recursive: true });
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'case-'));
  const root = path.join(directory, 'source');
  fs.mkdirSync(root);
  t.after(() => {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, root };
}
function manifest(directory, root) {
  const sourceSha = 'a'.repeat(40);
  const filename = path.join(directory, 'source.json');
  const files = inventory(root, { source: true }).map(({ path, sha256, mode }) => ({ path, sha256, mode }));
  fs.writeFileSync(filename, JSON.stringify({ source_sha: sourceSha, archive_sha256: 'b'.repeat(64), files }));
  return { filename, sourceSha };
}
test('source identity verifies exact archive bytes and rejects later modification or extra files', t => {
  const { directory, root } = fixture(t);
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const { filename, sourceSha } = manifest(directory, root);
  const verified = verifySource(root, sourceSha, filename);
  assert.equal(verified.files_verified, 1);
  assert.equal(verified.source_manifest_sha256, sha(fs.readFileSync(filename)));
  fs.writeFileSync(path.join(root, 'package.json'), '{"changed":true}');
  assert.throws(() => verifySource(root, sourceSha, filename), /source_file_mismatch/);
  fs.writeFileSync(path.join(root, 'extra.txt'), 'not archived');
  assert.throws(() => verifySource(root, sourceSha, filename), /source_file_count_mismatch/);
});
test('source refuses credential files even if included in a supplied manifest', t => {
  const { directory, root } = fixture(t);
  fs.writeFileSync(path.join(root, '.env'), 'SYNTHETIC_FIXTURE=not-a-secret');
  const { filename, sourceSha } = manifest(directory, root);
  assert.throws(() => verifySource(root, sourceSha, filename), /source_credentials_file_denied/);
});
test('package allows internal CLI symlinks and rejects an escaping link', t => {
  const { directory, root } = fixture(t);
  fs.writeFileSync(path.join(root, 'tool.js'), 'fixture');
  try { fs.symlinkSync('tool.js', path.join(root, 'tool')); }
  catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Windows account cannot create symlinks');
    throw error;
  }
  assert.equal(inventory(root).find(item => item.path === 'tool').target, 'tool.js');
  assert.throws(() => inventory(root, { source: true }), /source_symlink_denied/);
  fs.writeFileSync(path.join(directory, 'outside'), 'fixture');
  fs.symlinkSync('../outside', path.join(root, 'escape'));
  assert.throws(() => inventory(root), /package_symlink_escape/);
});
test('relative package paths cannot traverse or use Windows separators', () => {
  for (const value of ['../file', 'a/../file', '/file', 'a\\file', 'a//file', ''])
    assert.throws(() => safeRelative(value), /invalid_package_path/);
  assert.equal(safeRelative('dist/main.js'), 'dist/main.js');
});
test('documentation overlay preserves base identity and always marks a non-deployable candidate', t => {
  const { directory, root } = fixture(t);
  const document = 'docs/nodia-ai/knowledge/businesses/README.md';
  const filename = path.join(root, document);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const draft = revision => `---\n${JSON.stringify({ revision, document_status: 'draft', integration_status: 'unregistered', approval: null })}\n---\nDraft fixture.\n`;
  fs.writeFileSync(filename, draft(1));
  const baseHash = sha(fs.readFileSync(filename));
  const source = manifest(directory, root);
  const declared = JSON.parse(fs.readFileSync(source.filename, 'utf8'));
  fs.writeFileSync(filename, draft(2));
  declared.overlay = [{ path: document, base_sha256: baseHash, sha256: sha(fs.readFileSync(filename)) }];
  fs.writeFileSync(source.filename, JSON.stringify(declared));
  const result = verifySource(root, source.sourceSha, source.filename);
  assert.equal(result.source_sha, source.sourceSha);
  assert.equal(result.source_provenance, 'workspace_documentation_candidate');
  assert.equal(result.deployment_eligible, false);
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist/generated.js'), '// synthetic generated artifact');
  assert.deepEqual(verifySource(root, source.sourceSha, source.filename, { afterBuild: true }), result);
  assert.throws(() => verifySource(root, source.sourceSha, source.filename), /source_file_count_mismatch/);
  fs.appendFileSync(filename, 'Unexpected edit');
  assert.throws(() => verifySource(root, source.sourceSha, source.filename, { afterBuild: true }), /source_file_mismatch/);
});
test('overlay rejects unapproved path, wrong base digest and approval widening', t => {
  const { directory, root } = fixture(t);
  const document = 'docs/nodia-ai/knowledge/nodia-ai/features/capability-registry-gateway.md';
  const filename = path.join(root, document);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const text = status => `---\n${JSON.stringify({ document_status: status, integration_status: 'unregistered', approval: null })}\n---\nFixture.\n`;
  fs.writeFileSync(filename, text('draft'));
  const source = manifest(directory, root);
  const declared = JSON.parse(fs.readFileSync(source.filename, 'utf8'));
  const entry = { path: document, base_sha256: sha(fs.readFileSync(filename)), sha256: sha(fs.readFileSync(filename)) };
  for (const invalid of [{ ...entry, path: 'nodia-server/src/main.ts' }, { ...entry, base_sha256: 'c'.repeat(64) }]) {
    fs.writeFileSync(source.filename, JSON.stringify({ ...declared, overlay: [invalid] }));
    assert.throws(() => verifySource(root, source.sourceSha, source.filename), /invalid_documentation_overlay/);
  }
  fs.writeFileSync(filename, text('approved'));
  fs.writeFileSync(source.filename, JSON.stringify({ ...declared, overlay: [{ ...entry, sha256: sha(fs.readFileSync(filename)) }] }));
  assert.throws(() => verifySource(root, source.sourceSha, source.filename), /overlay_must_remain_unapproved_draft/);
});
test('production modes remove group writes, retain executable files and do not chmod symlink targets', t => {
  if (process.platform === 'win32') return t.skip('POSIX permission semantics are verified on Linux');
  const { directory, root } = fixture(t);
  const nested = path.join(root, 'nested');
  const plain = path.join(nested, 'plain.json');
  const executable = path.join(nested, 'tool');
  const outside = path.join(directory, 'outside');
  const link = path.join(root, 'link');
  fs.mkdirSync(nested);
  fs.writeFileSync(plain, '{}');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  fs.writeFileSync(outside, 'synthetic fixture');
  fs.chmodSync(root, 0o777);
  fs.chmodSync(nested, 0o775);
  fs.chmodSync(plain, 0o666);
  fs.chmodSync(executable, 0o777);
  fs.chmodSync(outside, 0o666);
  fs.symlinkSync('../outside', link);
  normalizeProductionModes(root);
  const mode = filename => fs.lstatSync(filename).mode & 0o777;
  assert.equal(mode(root), 0o755);
  assert.equal(mode(nested), 0o755);
  assert.equal(mode(plain), 0o644);
  assert.equal(mode(executable), 0o755);
  assert.equal(mode(outside), 0o666);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(link), '../outside');
});
