import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { captureSource, ciIdentity, confirmCapture, digestFile, forbiddenPackagePath,
  packageArtifact, parseArguments, publicConfiguration, safePath, verifyArtifact } from './artifact-release.mjs';

const rootDirectory = fileURLToPath(new URL('../../', import.meta.url));
const temporaryRoot = process.env.NODIA_ARTIFACT_TEST_TEMP_ROOT
  ? path.resolve(process.env.NODIA_ARTIFACT_TEST_TEMP_ROOT) : path.join(rootDirectory, '.tmp/ci/artifact-tests');
fs.mkdirSync(temporaryRoot, { recursive: true });
function fixture(t, { master = false } = {}) {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'case-'));
  const root = path.join(directory, 'checkout');
  const output = path.join(directory, 'output');
  fs.mkdirSync(root);
  const git = args => execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=' + path.join(directory, 'empty-hooks'), ...args], {
    encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Artifact fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Artifact fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  const write = (name, value) => {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, value);
    if (process.platform !== 'win32') fs.chmodSync(filename, 0o644);
  };
  git(['init', '--quiet']); git(['config', 'core.autocrlf', 'false']);
  write('.gitignore', 'nodia-client/dist/\nnodia-server/dist/\nnode_modules/\n.env\n');
  write('README.md', 'Synthetic committed source.\n');
  write('nodia-client/package.json', JSON.stringify({ type: 'module', scripts: {
    build: 'node -e "throw new Error(\'packager must not build\')"' } }));
  write('nodia-server/src/main.ts', 'export const fixture = true;\n');
  write('ops/production/stage-backend-candidate.py', fs.readFileSync(new URL('../production/stage-backend-candidate.py', import.meta.url)));
  const commit = () => { git(['add', '.']); git(['commit', '--quiet', '-m', 'Synthetic artifact fixture']); return git(['rev-parse', 'HEAD']); };
  const sourceSha = commit();
  const environment = { GITHUB_ACTIONS: 'true', GITHUB_SHA: sourceSha, GITHUB_REPOSITORY: 'fixture/example',
    GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/' + (master ? 'master' : 'development'),
    VITE_API_URL: master ? 'https://166.0.112.187/api/v1' : '',
    VITE_GOOGLE_CLIENT_ID: master ? 'synthetic-client-id.apps.googleusercontent.com' : '' };
  t.after(() => {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, root, output, sourceSha, environment, git, commit, write,
    options: { root, sourceSha, output, component: 'client', environment } };
}

const linuxPackaging = process.platform === 'linux' && process.arch === 'x64' && process.version === 'v24.22.2';
const needLinux = t => {
  if (!linuxPackaging) { t.skip('GNU tar packaging/verification uses exact Linux x64 Node24.22.2'); return false; }
  return true;
};
function buildFixture(f) {
  f.write('nodia-client/dist/index.html', '<!doctype html><script src="assets/app.js"></script>');
  f.write('nodia-client/dist/assets/app.js', 'throw new Error("fixture must never execute");\n');
}
function downloadFixture(f, result) {
  const output = path.join(f.directory, 'downloaded');
  fs.mkdirSync(output);
  for (const name of ['artifact-result.json', result.archive_file, result.manifest_file, result.metadata_file])
    fs.copyFileSync(path.join(f.output, name), path.join(output, name));
  return output;
}
function refreshArchiveEnvelope(output) {
  const resultFile = path.join(output, 'artifact-result.json');
  const result = JSON.parse(fs.readFileSync(resultFile));
  const metadataFile = path.join(output, result.metadata_file);
  const metadata = JSON.parse(fs.readFileSync(metadataFile));
  result.archive_sha256 = metadata.archive_sha256 = digestFile(path.join(output, result.archive_file));
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n');
  result.metadata_sha256 = digestFile(metadataFile);
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
}

test('paths, operational files and ambiguous CLI identities are rejected', () => {
  for (const name of ['../escape', '/escape', 'a\\b', 'a//b', 'a/../b', 'newline\nname', ''])
    assert.throws(() => safePath(name));
  for (const name of ['dist/.env', 'dist/.env.production', 'node_modules/.npmrc', 'dist/.codex/session.json'])
    assert.equal(forbiddenPackagePath(name), true);
  assert.equal(forbiddenPackagePath('dist/config/.envs.js'), false);
  assert.throws(() => parseArguments(['capture', '--root', '.', '--root', '.']));
  assert.throws(() => parseArguments(['capture', '--root', '.', '--source-sha', 'a'.repeat(40),
    '--output', '/tmp/out', '--component', 'client', '--run-id', '1']));
  const environment = { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'fixture/example',
    GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/development' };
  assert.equal(ciIdentity(environment, 'a'.repeat(40)).run_id, '1');
  for (const change of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_SHA: 'b'.repeat(40) },
    { GITHUB_RUN_ID: '0' }, { GITHUB_RUN_ATTEMPT: '-1' }, { GITHUB_REPOSITORY: '../wrong' },
    { GITHUB_REF: 'refs/heads/master\ncommand' }]) assert.throws(() => ciIdentity({ ...environment, ...change }, 'a'.repeat(40)));
});

test('production requires explicit valid public config; other branches remain ineligible with empty config', () => {
  const development = { event: 'push', ref: 'refs/heads/development' };
  const production = { event: 'push', ref: 'refs/heads/master' };
  const empty = publicConfiguration({}, development);
  assert.equal(empty.required_public_configuration_valid, false);
  assert.throws(() => publicConfiguration({}, production));
  const good = { VITE_API_URL: 'https://166.0.112.187/api/v1', VITE_GOOGLE_CLIENT_ID: 'synthetic-id.apps.googleusercontent.com' };
  assert.equal(publicConfiguration(good, production).required_public_configuration_valid, true);
  assert.notEqual(publicConfiguration(good, production).public_configuration_sha256, empty.public_configuration_sha256);
  assert.throws(() => publicConfiguration({ ...good, VITE_API_URL: 'http://localhost:3000' }, production));
  assert.throws(() => publicConfiguration({ ...good, VITE_GOOGLE_CLIENT_ID: 'not-configured' }, production));
});

test('capture binds all committed source bytes/archive to a GitHub run without exposing configuration values', t => {
  const f = fixture(t);
  const result = captureSource(f.options);
  assert.equal(result.source_sha, f.sourceSha);
  assert.equal(result.ci.run_id, '123');
  assert.equal(result.required_public_configuration_valid, false);
  const confirmed = confirmCapture(f.options);
  assert.equal(confirmed.verified.source_provenance, 'git_archive');
  assert.ok(confirmed.verified.files_verified >= 4);
  assert.equal(JSON.stringify(result).includes('VITE_GOOGLE_CLIENT_ID'), false);
});

test('dirty, ignored operational and output-inside-checkout inputs cannot be captured', t => {
  const f = fixture(t);
  f.write('README.md', 'Changed after commit');
  assert.throws(() => captureSource(f.options), /clean_committed_checkout_required/);
  f.git(['checkout', '--', 'README.md']);
  f.write('.env', 'SYNTHETIC_ONLY=true');
  assert.throws(() => captureSource(f.options), /source_file_count_mismatch|source_credentials_file_denied/);
  fs.unlinkSync(path.join(f.root, '.env'));
  assert.throws(() => captureSource({ ...f.options, output: path.join(f.root, 'artifact') }), /outside_checkout/);
});

test('assume-unchanged cannot hide changed source bytes from the capture', t => {
  const f = fixture(t);
  f.git(['update-index', '--assume-unchanged', 'README.md']);
  f.write('README.md', 'Silently changed bytes');
  assert.equal(f.git(['status', '--porcelain']), '');
  assert.throws(() => captureSource(f.options), /source_checkout_blob_mismatch/);
});

test('source changes and public configuration drift after build are rejected while ignored build output is allowed', t => {
  const f = fixture(t);
  captureSource(f.options);
  buildFixture(f);
  assert.equal(confirmCapture(f.options).capture.component, 'client');
  assert.throws(() => confirmCapture({ ...f.options, environment: { ...f.environment, VITE_GOOGLE_CLIENT_ID: 'changed' } }),
    /public_configuration_changed_after_capture/);
  f.write('README.md', 'Changed during build');
  assert.throws(() => confirmCapture(f.options), /source_file_mismatch/);
});

test('tampering with archived source proof or changing run identity fails after build', t => {
  const f = fixture(t);
  captureSource(f.options);
  assert.throws(() => confirmCapture({ ...f.options, environment: { ...f.environment, GITHUB_RUN_ATTEMPT: '2' } }), /captured_run_identity_mismatch/);
  fs.appendFileSync(path.join(f.output, '.artifact-source/source.tar'), 'tamper');
  assert.throws(() => confirmCapture(f.options), /source_capture_digest_mismatch/);
});

test('archive export attributes cannot silently change archive contents', t => {
  const f = fixture(t);
  f.write('.gitattributes', 'README.md export-ignore\n');
  const sourceSha = f.commit();
  assert.throws(() => captureSource({ ...f.options, sourceSha, environment: { ...f.environment, GITHUB_SHA: sourceSha } }),
    /archive_export_attributes_denied/);
});

test('prebuilt client roundtrip verifies content/run/config digests without building or executing the app', t => {
  if (!needLinux(t)) return;
  const f = fixture(t, { master: true });
  captureSource(f.options);
  buildFixture(f);
  const result = packageArtifact(f.options);
  assert.equal(result.production_eligible, true);
  assert.equal(result.build_invoked_by_packager, false);
  const output = downloadFixture(f, result);
  const verified = verifyArtifact({ ...f.options, output, requireProduction: true });
  assert.equal(verified.status, 'verified');
  assert.equal(verified.build_invoked_by_verifier, false);
  assert.equal(verified.archive_content_verified, true);
  assert.equal(verified.files_verified, 2);
  assert.throws(() => verifyArtifact({ ...f.options, output, runId: '999' }), /artifact_run_metadata_mismatch/);
  assert.throws(() => verifyArtifact({ ...f.options, output, sourceSha: 'f'.repeat(40) }), /artifact_result_identity_mismatch/);
  assert.throws(() => verifyArtifact({ ...f.options, output, requireProduction: true,
    environment: { ...f.environment, VITE_GOOGLE_CLIENT_ID: 'another-id.apps.googleusercontent.com' } }), /client_public_configuration_mismatch/);
  assert.throws(() => packageArtifact(f.options), /artifact_already_packaged/);
});

test('development client artifact is verifiable but cannot be promoted as production', t => {
  if (!needLinux(t)) return;
  const f = fixture(t);
  captureSource(f.options); buildFixture(f);
  const result = packageArtifact(f.options);
  assert.equal(result.production_eligible, false);
  assert.equal(verifyArtifact(f.options).production_eligible, false);
  assert.throws(() => verifyArtifact({ ...f.options, requireProduction: true }), /artifact_not_production_eligible/);
});

test('operational files and symlinks inside prebuilt client dist cannot leak into an archive', t => {
  if (!needLinux(t)) return;
  const f = fixture(t);
  captureSource(f.options); buildFixture(f);
  f.write('nodia-client/dist/.env.production', 'SYNTHETIC_ONLY=true');
  assert.throws(() => packageArtifact(f.options), /operational_data_in_client_dist/);
  fs.unlinkSync(path.join(f.root, 'nodia-client/dist/.env.production'));
  fs.symlinkSync('../package.json', path.join(f.root, 'nodia-client/dist/leak'));
  assert.throws(() => packageArtifact(f.options), /source_symlink_denied/);
});

test('changed downloaded archive bytes fail before parsing even when paths look correct', t => {
  if (!needLinux(t)) return;
  const f = fixture(t);
  captureSource(f.options); buildFixture(f);
  const result = packageArtifact(f.options);
  const output = downloadFixture(f, result);
  fs.appendFileSync(path.join(output, result.archive_file), 'changed');
  assert.throws(() => verifyArtifact({ ...f.options, output }), /artifact_download_digest_mismatch/);
});

test('rewritten outer hashes cannot authorize traversal or changed payload inside a downloaded tar', t => {
  if (!needLinux(t)) return;
  const f = fixture(t);
  captureSource(f.options); buildFixture(f);
  const result = packageArtifact(f.options);
  const output = downloadFixture(f, result);
  const stage = path.join(f.directory, 'synthetic-repacked');
  fs.mkdirSync(stage);
  execFileSync('tar', ['-xzf', path.join(output, result.archive_file), '-C', stage]);
  fs.writeFileSync(path.join(stage, 'dist/assets/app.js'), 'changed-payload');
  const repack = extra => execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
    ...extra, '-czf', path.join(output, result.archive_file), '-C', stage, '.']);
  repack([]); refreshArchiveEnvelope(output);
  assert.throws(() => verifyArtifact({ ...f.options, output }), /artifact_archive_validation_failed/);
  repack(['--transform=s|dist/assets/app.js|../../escape|']); refreshArchiveEnvelope(output);
  assert.throws(() => verifyArtifact({ ...f.options, output }), /artifact_archive_validation_failed/);
  assert.equal(fs.existsSync(path.join(f.directory, 'escape')), false);
});
