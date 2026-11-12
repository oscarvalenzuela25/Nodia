// Packages a prebuilt Server; never imports application bootstrap or connects to services.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
export const documentationOverlayPaths = new Set([
  'docs/nodia-ai/knowledge/businesses/README.md',
  'docs/nodia-ai/knowledge/nodia-ai/README.md',
  'docs/nodia-ai/knowledge/nodia-ai/features/capability-registry-gateway.md',
]);
export function safeRelative(value) {
  ensure(typeof value === 'string' && value.length > 0 && !value.includes('\\') &&
    !path.posix.isAbsolute(value) && !value.split('/').some(part => ['', '.', '..'].includes(part)), 'invalid_package_path');
  return value;
}
export function inventory(root, { source = false } = {}) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (source && directory === '' && entry.name === '.git') continue;
      const relative = directory ? `${directory}/${entry.name}` : entry.name;
      safeRelative(relative);
      const absolute = path.join(root, relative);
      const info = fs.lstatSync(absolute);
      if (info.isSymbolicLink()) {
        ensure(!source, 'source_symlink_denied');
        const target = fs.readlinkSync(absolute);
        ensure(!path.isAbsolute(target) && inside(root, fs.realpathSync(absolute)), 'package_symlink_escape');
        entries.push({ path: relative, type: 'symlink', target, sha256: hash(target) });
      } else if (info.isDirectory()) visit(relative);
      else {
        ensure(info.isFile(), 'package_special_file_denied');
        entries.push({ path: relative, type: 'file', bytes: info.size,
          mode: (info.mode & 0o777).toString(8).padStart(4, '0'), sha256: hash(fs.readFileSync(absolute)) });
      }
    }
  }
  visit('');
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function normalizeProductionModes(root) {
  function visit(filename) {
    const metadata = fs.lstatSync(filename);
    // Never chmod through a link. Inventory validates its relative target later.
    if (metadata.isSymbolicLink()) return;
    if (metadata.isDirectory()) {
      fs.chmodSync(filename, 0o755);
      for (const name of fs.readdirSync(filename)) visit(path.join(filename, name));
    } else {
      ensure(metadata.isFile(), 'package_special_file_denied');
      fs.chmodSync(filename, metadata.mode & 0o111 ? 0o755 : 0o644);
    }
  }
  ensure(fs.lstatSync(root).isDirectory() && !fs.lstatSync(root).isSymbolicLink(), 'invalid_package_root');
  visit(root);
}
export function verifySource(root, sourceSha, manifestFile, { afterBuild = false } = {}) {
  ensure(/^[a-f0-9]{40}$/.test(sourceSha), 'invalid_source_sha');
  const manifest = json(manifestFile);
  ensure(manifest.source_sha === sourceSha && /^[a-f0-9]{64}$/.test(manifest.archive_sha256) &&
    Array.isArray(manifest.files) && manifest.files.length > 0, 'invalid_source_manifest');
  const expected = new Map();
  for (const item of manifest.files) {
    const name = safeRelative(item.path);
    ensure(!expected.has(name) && /^[a-f0-9]{64}$/.test(item.sha256), 'invalid_source_manifest_entry');
    expected.set(name, item);
  }
  const overlay = manifest.overlay ?? [];
  ensure(Array.isArray(overlay), 'invalid_documentation_overlay');
  const overrides = new Map();
  for (const item of overlay) {
    const name = safeRelative(item.path);
    ensure(documentationOverlayPaths.has(name) && !overrides.has(name) &&
      /^[a-f0-9]{64}$/.test(item.base_sha256) && /^[a-f0-9]{64}$/.test(item.sha256) &&
      expected.get(name)?.sha256 === item.base_sha256, 'invalid_documentation_overlay');
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(fs.readFileSync(path.join(root, name), 'utf8'));
    ensure(match, 'overlay_frontmatter_missing');
    const metadata = JSON.parse(match[1]);
    ensure(metadata.document_status === 'draft' && metadata.integration_status === 'unregistered' && metadata.approval === null,
      'overlay_must_remain_unapproved_draft');
    overrides.set(name, item);
  }
  // After build only ignored/generated files may have appeared. All declared
  // archive bytes (including documented overlays) must still match exactly.
  const actual = afterBuild ? [...expected.keys()].map(name => {
    const absolute = path.join(root, name);
    const info = fs.lstatSync(absolute);
    ensure(info.isFile() && !info.isSymbolicLink() && inside(root, fs.realpathSync(absolute)), 'source_file_type_mismatch');
    return { path: name, type: 'file', bytes: info.size,
      mode: (info.mode & 0o777).toString(8).padStart(4, '0'), sha256: hash(fs.readFileSync(absolute)) };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) : inventory(root, { source: true });
  ensure(actual.length === manifest.files.length, 'source_file_count_mismatch');
  for (const item of actual) {
    ensure(!item.path.split('/').some(part => part === '.env' || part === '.npmrc'), 'source_credentials_file_denied');
    const match = expected.get(item.path);
    ensure(match && (overrides.get(item.path)?.sha256 ?? match.sha256) === item.sha256 && match.mode === item.mode, 'source_file_mismatch');
  }
  return { source_sha: sourceSha, archive_sha256: manifest.archive_sha256,
    source_manifest_sha256: hash(fs.readFileSync(manifestFile)),
    snapshot_tree_sha256: hash(JSON.stringify(actual)), files_verified: actual.length,
    source_provenance: overlay.length ? 'workspace_documentation_candidate' : 'git_archive',
    deployment_eligible: overlay.length === 0, overlay };
}

const runtimeScripts = ['render-codex-pdf.mjs', 'seed-core.mjs', 'nodia-ai-journal.mjs',
  'nodia-ai-backups.mjs', 'nodia-ai-backup-database.mjs', 'prepare-nodia-ai-restore.mjs'];
const requiredAssets = ['main.js', 'nodia-ai-worker.js', 'config/data-source.js',
  'nodia-ai-tools/config/common-schema.json', 'nodia-ai-context/config/knowledge-pin.json',
  'nodia-ai-context/config/knowledge-schema.json', 'nodia-ai-runtime/config/runtime-policy.json',
  'nodia-ai-conversation/config/conversation-policy.json', 'nodia-ai-invoice-ocr/contracts/invoice-ocr.json'];
export function validateCompiledAssets(server, repository) {
  for (const relative of requiredAssets) {
    const filename = path.join(server, 'dist', relative);
    ensure(fs.statSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), 'compiled_asset_missing');
  }
  const shared = fs.readFileSync(path.join(server, 'dist/nodia-ai-tools/config/common-schema.json'));
  ensure(shared.equals(fs.readFileSync(path.join(repository, 'docs/mvp/nodia-ai-v1-common-contracts.schema.json'))), 'compiled_common_schema_mismatch');
  const root = path.join(server, 'dist/nodia-ai/knowledge');
  const manifest = json(path.join(root, 'manifest.json'));
  const pin = json(path.join(server, 'dist/nodia-ai-context/config/knowledge-pin.json'));
  const schema = fs.readFileSync(path.join(server, 'dist/nodia-ai-context/config/knowledge-schema.json'));
  ensure(/^[a-f0-9]{64}$/.test(manifest.release_id) && pin.release_id === manifest.release_id &&
    pin.catalog_release === manifest.catalog_release && pin.schema_sha256 === hash(schema) &&
    manifest.contract_schema_sha256 === hash(schema) && Array.isArray(manifest.fragments), 'compiled_knowledge_pin_mismatch');
  const allowedMarkdown = new Set();
  for (const fragment of manifest.fragments) {
    ensure(/^[a-f0-9]{64}$/.test(fragment.sha256) && fragment.asset_path === `fragments/${fragment.sha256}.md`, 'invalid_knowledge_fragment_path');
    const filename = path.join(root, fragment.asset_path);
    ensure(fs.lstatSync(filename).isFile(), 'invalid_knowledge_fragment');
    const bytes = fs.readFileSync(filename);
    ensure(bytes.length === fragment.byte_length && hash(bytes) === fragment.sha256, 'knowledge_fragment_mismatch');
    allowedMarkdown.add(`dist/nodia-ai/knowledge/${fragment.asset_path}`);
  }
  for (const item of inventory(path.join(server, 'dist'), { source: true })) {
    ensure(item.path.endsWith('.js') || item.path.endsWith('.json') || item.path.endsWith('.map') || item.path.endsWith('.ts') ||
      allowedMarkdown.has(`dist/${item.path}`), 'unrecognized_compiled_asset');
  }
  const policyBytes = fs.readFileSync(path.join(repository, 'docs/mvp/nodia-ai-v1-runtime-policy.json'));
  for (const relative of ['nodia-ai-runtime/config/runtime-policy.json', 'nodia-ai-conversation/config/conversation-policy.json']) {
    const asset = json(path.join(server, 'dist', relative));
    const { contentHash, ...payload } = asset;
    ensure(asset.policyHash === hash(policyBytes) && contentHash === hash(JSON.stringify(payload)), 'compiled_policy_mismatch');
  }
  return { knowledge_release_id: manifest.release_id, catalog_release: manifest.catalog_release,
    knowledge_fragments: manifest.fragments.length, common_schema_sha256: hash(shared), runtime_policy_sha256: hash(policyBytes) };
}
function cleanEnvironment(home) {
  for (const name of ['npmrc-user', 'npmrc-global']) {
    const filename = path.join(home, name);
    ensure(!fs.existsSync(filename) || (fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink()), 'invalid_build_npm_configuration');
    fs.writeFileSync(filename, '', { mode: 0o600 });
    fs.chmodSync(filename, 0o600);
  }
  return { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC',
    NPM_CONFIG_USERCONFIG: path.join(home, 'npmrc-user'), NPM_CONFIG_GLOBALCONFIG: path.join(home, 'npmrc-global') };
}
function requiredArguments(argv) {
  ensure(argv.length === 8, 'usage_expected_root_sha_output_source_manifest');
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    ensure(['--root', '--source-sha', '--output', '--source-manifest'].includes(argv[i]) && !Object.hasOwn(result, argv[i]), 'invalid_package_argument');
    result[argv[i]] = argv[i + 1];
  }
  return result;
}
export function packageRelease(argv = process.argv.slice(2)) {
  ensure(process.platform === 'linux' && process.arch === 'x64' && process.version === 'v24.22.2', 'linux_x64_node_24_22_2_required');
  const args = requiredArguments(argv);
  const root = fs.realpathSync(args['--root']);
  const sourceSha = args['--source-sha'];
  const sourceManifest = path.resolve(args['--source-manifest']);
  const output = path.resolve(args['--output']);
  ensure(!inside(root, output), 'output_must_be_outside_snapshot');
  // The builder verified these bytes before npm/build mutated generated sources.
  const provenance = json(path.join(output, 'verified-source.json'));
  ensure(provenance.source_sha === sourceSha && provenance.source_manifest_sha256 === hash(fs.readFileSync(sourceManifest)), 'source_verification_missing');
  const confirmedSource = verifySource(root, sourceSha, sourceManifest, { afterBuild: true });
  ensure(JSON.stringify(confirmedSource) === JSON.stringify(provenance), 'source_changed_during_build');
  const checks = json(path.join(output, 'build-checks.json'));
  ensure(checks.status === 'passed' && checks.source_sha === sourceSha, 'build_checks_missing');
  const server = path.join(root, 'nodia-server');
  const assets = validateCompiledAssets(server, root);
  const stage = fs.mkdtempSync(path.join(output, '.backend-stage-'));
  fs.chmodSync(stage, 0o755);
  const buildHome = path.join(output, '.build-home');
  fs.mkdirSync(buildHome, { recursive: true, mode: 0o700 });
  let succeeded = false;
  try {
    for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(server, name), path.join(stage, name));
    ensure(json(path.join(stage, 'package.json')).type === 'module', 'esm_package_required');
    fs.cpSync(path.join(server, 'dist'), path.join(stage, 'dist'), { recursive: true, dereference: false });
    fs.mkdirSync(path.join(stage, 'scripts'));
    for (const name of runtimeScripts) {
      const filename = path.join(server, 'scripts', name);
      ensure(fs.lstatSync(filename).isFile(), 'runtime_script_missing');
      fs.copyFileSync(filename, path.join(stage, 'scripts', name));
    }
    const env = cleanEnvironment(buildHome);
    execFileSync('npm', ['ci', '--omit=dev', '--include=optional', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, env, stdio: 'inherit' });
    const nativeCheck = `import { createRequire } from 'node:module';
      const require = createRequire(process.cwd() + '/package.json');
      const canvas = require('@napi-rs/canvas');
      if (!canvas.createCanvas(1, 1).toBuffer('image/png').length) throw Error('canvas_unavailable');
      require('pg'); require('typeorm');
      require.resolve('@openai/codex-linux-x64/package.json');
      console.log('Linux native canvas, pg/TypeORM and Codex platform package: passed');`;
    execFileSync(process.execPath, ['--input-type=module', '-e', nativeCheck], { cwd: stage, env, stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/@openai/codex/bin/codex.js', '--version'], { cwd: stage, env, stdio: 'inherit', timeout: 15000 });
    normalizeProductionModes(stage);
    const files = inventory(stage);
    for (const file of files) ensure(!file.path.split('/').some(part => part === '.env' || /^(?:browser_profiles?|session_states?|agentic_home|\.codex)$/.test(part)), 'operational_data_in_package');
    const treeHash = hash(JSON.stringify(files));
    const candidate = provenance.source_provenance === 'workspace_documentation_candidate';
    const releaseId = `${candidate ? 'backend-candidate' : 'backend'}-${sourceSha.slice(0, 12)}-${treeHash.slice(0, 12)}`;
    const manifest = { schema_version: 1, release_id: releaseId, source_sha: sourceSha, source: provenance,
      source_provenance: provenance.source_provenance, deployment_eligible: !candidate,
      eligibility_scope: 'Source identity and artifact checks only; not rollout or environment acceptance.',
      filesystem_policy: { directories: '0755', regular_files: '0644_or_0755_if_originally_executable',
        symlinks: 'relative_targets_inside_package', archive_uid: 0, archive_gid: 0 },
      package_tree_sha256: treeHash, runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { cwd: stage, env, encoding: 'utf8' }).trim(),
        executable_sha256: hash(fs.readFileSync(process.execPath)),
        platform: process.platform, arch: process.arch, glibc: process.report.getReport().header.glibcVersionRuntime ?? null },
      tooling: ['package-backend-release.mjs', 'build-backend-release.sh'].map(name => ({ path: name,
        sha256: hash(fs.readFileSync(new URL(name, import.meta.url))) })),
      checks, compiled_assets: assets, package_lock_sha256: hash(fs.readFileSync(path.join(stage, 'package-lock.json'))),
      native_packages: ['@napi-rs/canvas-linux-x64-gnu', '@openai/codex-linux-x64'].map(name => ({ name, version: json(path.join(stage, 'node_modules', name, 'package.json')).version })),
      files };
    const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(stage, 'release-manifest.json'), manifestBytes);
    fs.chmodSync(path.join(stage, 'release-manifest.json'), 0o644);
    const archive = path.join(output, `${releaseId}.tar.gz`);
    const manifestFile = path.join(output, `${releaseId}.manifest.json`);
    ensure(!fs.existsSync(archive) && !fs.existsSync(manifestFile), 'release_output_already_exists');
    execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', archive, '-C', stage, '.'], { env, stdio: 'inherit' });
    fs.writeFileSync(manifestFile, manifestBytes);
    const archiveHash = hash(fs.readFileSync(archive));
    fs.writeFileSync(path.join(output, `${releaseId}.sha256`), `${archiveHash}  ${path.basename(archive)}\n${hash(manifestBytes)}  ${path.basename(manifestFile)}\n`);
    succeeded = true;
    console.log(JSON.stringify({ release_id: releaseId, archive, archive_sha256: archiveHash, manifest: manifestFile, files: files.length }));
    return manifest;
  } finally {
    // Only a fresh, private staging directory created above is removed.
    if (succeeded) fs.rmSync(stage, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { packageRelease(); }
  catch (error) {
    console.error(error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'backend_packaging_failed');
    process.exitCode = 1;
  }
}
