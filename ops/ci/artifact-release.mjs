// Capture a committed checkout, then package its already checked build. No build command is invoked.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory, normalizeProductionModes, packageRelease, verifySource } from '../production/package-backend-release.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const matches = (value, expression) => typeof value === 'string' && expression.exec(value)?.[0] === value;
const comparePath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
const inside = (root, filename) => {
  const relative = path.relative(root, filename);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
};
const moduleFilename = fileURLToPath(import.meta.url);

export function safePath(value) {
  ensure(typeof value === 'string' && value && !value.includes('\\') && !path.posix.isAbsolute(value) &&
    !/[\x00-\x1f\x7f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'),
  'artifact_path_invalid');
  return value;
}

export function forbiddenPackagePath(value) {
  return safePath(value).split('/').some(part => /^\.env(?:\.|$)/.test(part) ||
    ['.npmrc', '.git', '.codex', 'browser_profile', 'browser_profiles', 'session_state',
      'session_states', 'agentic_home'].includes(part));
}

export function digestFile(filename) {
  const digest = createHash('sha256');
  const descriptor = fs.openSync(filename, 'r');
  const buffer = Buffer.alloc(128 * 1024);
  try {
    let count;
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, count));
  } finally { fs.closeSync(descriptor); }
  return digest.digest('hex');
}

function writeNewJson(filename, value, mode = 0o600) {
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode });
}

function git(root, args, options = {}) {
  return execFileSync('git', ['-C', root, '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.attributesFile=/dev/null', ...args], {
    env: { ...process.env, GIT_ATTR_NOSYSTEM: '1' }, maxBuffer: 32 * 1024 * 1024, ...options,
  });
}

function exactOutput(root, output, { create = false } = {}) {
  const resolved = path.resolve(output);
  ensure(!inside(root, resolved), 'artifact_output_must_be_outside_checkout');
  if (create) fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  ensure(fs.lstatSync(resolved).isDirectory() && !fs.lstatSync(resolved).isSymbolicLink(), 'artifact_output_invalid');
  const real = fs.realpathSync(resolved);
  ensure(!inside(root, real), 'artifact_output_must_be_outside_checkout');
  return real;
}

export function ciIdentity(environment, sourceSha) {
  ensure(environment.GITHUB_ACTIONS === 'true' && matches(sourceSha, /^[a-f0-9]{40}$/) &&
    environment.GITHUB_SHA === sourceSha, 'github_source_identity_required');
  ensure(matches(environment.GITHUB_REPOSITORY, /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/) &&
    matches(environment.GITHUB_RUN_ID, /^[1-9][0-9]*$/) &&
    matches(environment.GITHUB_RUN_ATTEMPT, /^[1-9][0-9]*$/) &&
    ['push', 'pull_request', 'workflow_dispatch'].includes(environment.GITHUB_EVENT_NAME) &&
    matches(environment.GITHUB_REF, /^refs\/(?:heads\/[A-Za-z0-9._/-]+|pull\/[0-9]+\/merge)$/),
  'github_run_identity_required');
  return { repository: environment.GITHUB_REPOSITORY, run_id: environment.GITHUB_RUN_ID,
    run_attempt: environment.GITHUB_RUN_ATTEMPT, event: environment.GITHUB_EVENT_NAME, ref: environment.GITHUB_REF };
}

export function publicConfiguration(environment, ci) {
  const values = { VITE_API_URL: environment.VITE_API_URL ?? '', VITE_GOOGLE_CLIENT_ID: environment.VITE_GOOGLE_CLIENT_ID ?? '' };
  const valid = values.VITE_API_URL === 'https://166.0.112.187/api/v1' &&
    matches(values.VITE_GOOGLE_CLIENT_ID, /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/);
  ensure(!(ci.event === 'push' && ci.ref === 'refs/heads/master') || valid, 'production_public_configuration_required');
  return { public_configuration_sha256: sha(JSON.stringify(values)), required_public_configuration_valid: valid };
}

function capturedPaths(output) {
  const directory = path.join(output, '.artifact-source');
  return { directory, archive: path.join(directory, 'source.tar'), manifest: path.join(directory, 'source-manifest.json'),
    capture: path.join(directory, 'capture.json'), verified: path.join(output, 'verified-source.json') };
}

export function captureSource({ root, sourceSha, output, component, environment = process.env }) {
  ensure(['client', 'server'].includes(component), 'artifact_component_invalid');
  root = fs.realpathSync(root);
  const ci = ciIdentity(environment, sourceSha);
  const configuration = component === 'client' ? publicConfiguration(environment, ci) : {};
  ensure(git(root, ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === sourceSha, 'checkout_sha_mismatch');
  ensure(git(root, ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }) === '', 'clean_committed_checkout_required');
  output = exactOutput(root, output, { create: true });
  ensure(fs.readdirSync(output).length === 0, 'artifact_output_not_empty');
  const entries = git(root, ['ls-tree', '-r', '-z', '--full-tree', sourceSha]).toString('utf8').split('\0').filter(Boolean);
  const files = entries.map(entry => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    ensure(match, 'source_special_file_or_symlink_denied');
    const name = safePath(match[3]);
    ensure(!name.split('/').some(part => part === '.npmrc' ||
      (/^\.env(?:\.|$)/.test(part) && !['.env.example', '.env.template', '.env.sample'].includes(part))),
    'source_credentials_file_denied');
    const filename = path.join(root, name);
    const info = fs.lstatSync(filename);
    ensure(info.isFile() && !info.isSymbolicLink() && inside(root, fs.realpathSync(filename)), 'source_checkout_file_invalid');
    const bytes = fs.readFileSync(filename);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    ensure(blob === match[2], 'source_checkout_blob_mismatch');
    const mode = (info.mode & 0o777).toString(8).padStart(4, '0');
    ensure(process.platform === 'win32' || mode === (match[1] === '100755' ? '0755' : '0644'), 'source_checkout_mode_mismatch');
    return { path: name, sha256: sha(bytes), mode };
  }).sort(comparePath);
  ensure(files.length > 0, 'empty_source_checkout');
  // Archive export attributes would make git archive differ from the checked blobs.
  const attributes = git(root, ['check-attr', '-z', '--stdin', 'export-ignore', 'export-subst'], {
    input: files.map(item => item.path).join('\0') + '\0',
  }).toString('utf8').split('\0');
  for (let index = 0; index + 2 < attributes.length; index += 3)
    ensure(['unspecified', 'unset'].includes(attributes[index + 2]), 'archive_export_attributes_denied');
  const locations = capturedPaths(output);
  fs.mkdirSync(locations.directory, { mode: 0o700 });
  git(root, ['archive', '--format=tar', `--output=${locations.archive}`, sourceSha]);
  writeNewJson(locations.manifest, { source_sha: sourceSha, archive_sha256: digestFile(locations.archive), files });
  const verified = verifySource(root, sourceSha, locations.manifest);
  writeNewJson(locations.verified, verified);
  const result = { schema_version: 1, component, source_sha: sourceSha, ci, ...configuration,
    source_manifest_sha256: digestFile(locations.manifest), source_archive_sha256: digestFile(locations.archive),
    verified_source_sha256: digestFile(locations.verified) };
  writeNewJson(locations.capture, result);
  return result;
}

export function confirmCapture({ root, sourceSha, output, component, environment = process.env }) {
  root = fs.realpathSync(root);
  output = exactOutput(root, output);
  const locations = capturedPaths(output);
  const capture = readJson(locations.capture);
  ensure(capture.schema_version === 1 && capture.component === component && capture.source_sha === sourceSha &&
    JSON.stringify(capture.ci) === JSON.stringify(ciIdentity(environment, sourceSha)), 'captured_run_identity_mismatch');
  ensure(digestFile(locations.manifest) === capture.source_manifest_sha256 &&
    digestFile(locations.archive) === capture.source_archive_sha256 &&
    digestFile(locations.verified) === capture.verified_source_sha256, 'source_capture_digest_mismatch');
  if (component === 'client') {
    const configuration = publicConfiguration(environment, capture.ci);
    ensure(configuration.public_configuration_sha256 === capture.public_configuration_sha256 &&
      configuration.required_public_configuration_valid === capture.required_public_configuration_valid,
    'public_configuration_changed_after_capture');
  }
  ensure(git(root, ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === sourceSha, 'checkout_sha_mismatch');
  const verified = verifySource(root, sourceSha, locations.manifest, { afterBuild: true });
  ensure(JSON.stringify(verified) === JSON.stringify(readJson(locations.verified)), 'source_changed_after_capture');
  return { capture, verified, locations, output, root };
}

function clientPackage(root, output, sourceSha, verified) {
  const input = path.join(root, 'nodia-client', 'dist');
  ensure(fs.lstatSync(input).isDirectory() && !fs.lstatSync(input).isSymbolicLink(), 'client_dist_required');
  const sourceFiles = inventory(input, { source: true });
  ensure(sourceFiles.some(item => item.path === 'index.html'), 'client_index_required');
  ensure(sourceFiles.every(item => !forbiddenPackagePath(item.path)), 'operational_data_in_client_dist');
  const stage = fs.mkdtempSync(path.join(output, '.client-stage-'));
  let complete = false;
  try {
    fs.cpSync(input, path.join(stage, 'dist'), { recursive: true, dereference: false });
    normalizeProductionModes(stage);
    const files = inventory(stage);
    const treeHash = sha(JSON.stringify(files));
    const releaseId = `client-${sourceSha.slice(0, 12)}-${treeHash.slice(0, 12)}`;
    const manifest = { schema_version: 1, component: 'client', release_id: releaseId, source_sha: sourceSha,
      source: verified, source_provenance: 'git_archive', deployment_eligible: true,
      eligibility_scope: 'Committed source and artifact identity only; not CI-wide success or rollout acceptance.',
      package_tree_sha256: treeHash, files };
    writeNewJson(path.join(stage, 'release-manifest.json'), manifest, 0o644);
    const archive = path.join(output, `${releaseId}.tar.gz`);
    ensure(!fs.existsSync(archive), 'release_output_already_exists');
    execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', archive, '-C', stage, '.']);
    writeNewJson(path.join(output, `${releaseId}.manifest.json`), manifest, 0o644);
    complete = true;
    return manifest;
  } finally {
    if (complete) fs.rmSync(stage, { recursive: true, force: true });
  }
}

function requirePackagingRuntime() {
  ensure(process.platform === 'linux' && process.arch === 'x64' && process.version === 'v24.22.2', 'linux_x64_node_24_22_2_required');
}

export function packageArtifact(options) {
  requirePackagingRuntime();
  const { root, output, capture, verified, locations } = confirmCapture(options);
  ensure(!fs.existsSync(path.join(output, 'artifact-result.json')) && !fs.existsSync(path.join(output, 'build-metadata.json')),
    'artifact_already_packaged');
  let manifest;
  if (options.component === 'server') {
    writeNewJson(path.join(output, 'build-checks.json'), { status: 'passed', source_sha: options.sourceSha,
      checks: ['prebuilt_assets_and_source_closure', 'production_dependency_closure', 'native_cli_availability'],
      eligibility_scope: 'Packaging checks completed before manifest emission; component tests and global CI remain external gates.',
      packaging_database_or_inference_executed: false });
    manifest = packageRelease(['--root', root, '--source-sha', options.sourceSha, '--output', output, '--source-manifest', locations.manifest]);
  } else manifest = clientPackage(root, output, options.sourceSha, verified);
  ensure(manifest.files.every(item => !forbiddenPackagePath(item.path)), 'operational_data_in_package');
  // packageRelease rechecks tracked source. Recheck both lanes after copying/installing too.
  confirmCapture(options);
  const archiveFile = `${manifest.release_id}.tar.gz`;
  const manifestFile = `${manifest.release_id}.manifest.json`;
  const productionEligible = capture.ci.event === 'push' && capture.ci.ref === 'refs/heads/master' &&
    (options.component !== 'client' || capture.required_public_configuration_valid === true);
  const metadata = { schema_version: 1, component: options.component, source_sha: options.sourceSha, ci: capture.ci,
    production_eligible: productionEligible,
    eligibility_scope: 'Run/ref/configuration identity only; no global CI or environment acceptance is asserted.',
    ...(options.component === 'client' ? { public_configuration_sha256: capture.public_configuration_sha256,
      required_public_configuration_valid: capture.required_public_configuration_valid } : {}),
    source_manifest_sha256: capture.source_manifest_sha256, source_archive_sha256: capture.source_archive_sha256,
    release_id: manifest.release_id, package_tree_sha256: manifest.package_tree_sha256,
    archive_file: archiveFile, archive_sha256: digestFile(path.join(output, archiveFile)),
    manifest_file: manifestFile, manifest_sha256: digestFile(path.join(output, manifestFile)),
    build_invoked_by_packager: false };
  writeNewJson(path.join(output, 'build-metadata.json'), metadata, 0o644);
  const result = { schema_version: 1, component: options.component, source_sha: options.sourceSha,
    release_id: manifest.release_id, package_tree_sha256: manifest.package_tree_sha256,
    archive_file: archiveFile, archive_sha256: metadata.archive_sha256,
    manifest_file: manifestFile, manifest_sha256: metadata.manifest_sha256,
    metadata_file: 'build-metadata.json', metadata_sha256: digestFile(path.join(output, 'build-metadata.json')),
    ci: capture.ci, production_eligible: productionEligible, build_invoked_by_packager: false };
  writeNewJson(path.join(output, 'artifact-result.json'), result, 0o644);
  return result;
}

const archiveReader = String.raw`
import hashlib,importlib.util,json,pathlib,re,sys,tarfile
stage,archive_name,manifest_name,component=sys.argv[1:]
spec=importlib.util.spec_from_file_location('stage_reader',stage)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def require(value):
    if not value: raise ValueError('archive_invalid')
def forbidden(name):
    return any(re.match(r'^\.env(?:\.|$)',part) or part in ('.npmrc','.git','.codex','browser_profile',
        'browser_profiles','session_state','session_states','agentic_home') for part in name.split('/'))
with tarfile.open(archive_name,'r:gz') as archive:
    if component=='server':
        plan=module.read_plan(archive,allow_git_release=True)
        manifest=plan['manifest'];manifest_bytes=plan['manifest_bytes']
        expected=plan['expected'];nodes=plan['nodes']
    else:
        nodes={};total=0
        for member in archive:
            require(len(nodes)<module.MAX_MEMBERS and member.sparse is None and
                member.type in (tarfile.DIRTYPE,tarfile.REGTYPE,tarfile.AREGTYPE))
            directory=member.isdir();name=module.relative_name(member.name,directory=directory)
            require(name not in nodes and member.uid==member.gid==0 and
                (directory and member.mode==0o755 or not directory and member.mode in (0o644,0o755)))
            require(not name or name=='dist' or name.startswith('dist/') or name=='release-manifest.json')
            if not directory:
                require(0<=member.size<=module.MAX_MEMBER)
                total+=member.size;require(total<=module.MAX_UNPACKED)
            nodes[name]={'type':'directory' if directory else 'file','member':member}
        require('' in nodes and nodes['']['type']=='directory' and 'dist' in nodes and nodes['dist']['type']=='directory')
        node=nodes.get('release-manifest.json');require(node and node['type']=='file' and node['member'].size<=module.MAX_MANIFEST)
        with archive.extractfile(node['member']) as stream:manifest_bytes=stream.read(module.MAX_MANIFEST+1)
        manifest=module.strict_json(manifest_bytes)
        require(set(manifest)=={'schema_version','component','release_id','source_sha','source','source_provenance',
            'deployment_eligible','eligibility_scope','package_tree_sha256','files'} and
            manifest['schema_version']==1 and manifest['component']=='client' and manifest['source_provenance']=='git_archive' and
            manifest['deployment_eligible'] is True)
        require(isinstance(manifest['files'],list) and 0<len(manifest['files'])<module.MAX_MEMBERS)
        expected={}
        for item in manifest['files']:
            require(isinstance(item,dict) and set(item)=={'path','type','bytes','mode','sha256'} and item['type']=='file')
            name=module.relative_name(item['path']);require(name.startswith('dist/') and name not in expected)
            require(type(item['bytes']) is int and 0<=item['bytes']<=module.MAX_MEMBER and
                item['mode'] in ('0644','0755') and re.fullmatch('[a-f0-9]{64}',item['sha256']))
            expected[name]=item
        require('dist/index.html' in expected and
            {name for name,node in nodes.items() if node['type']=='file'}==set(expected)|{'release-manifest.json'})
        tree=hashlib.sha256(json.dumps(manifest['files'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        require(tree==manifest['package_tree_sha256'] and manifest['release_id']==
            'client-'+manifest['source_sha'][:12]+'-'+tree[:12])
    require(manifest_bytes==pathlib.Path(manifest_name).read_bytes())
    for name in expected:require(not forbidden(name))
    # Inventory order need not equal tar traversal order. A second streaming pass
    # avoids quadratic backwards seeks/decompression for sibling directory names.
    checked=set()
    with tarfile.open(archive_name,'r|gz') as payload:
        for member in payload:
            if not member.isfile():continue
            name=module.relative_name(member.name)
            if name=='release-manifest.json':continue
            require(name in expected and name not in checked)
            item=expected[name]
            require(item['type']=='file' and member.size==item['bytes'] and member.mode==int(item['mode'],8))
            digest=hashlib.sha256()
            with payload.extractfile(member) as stream:
                while True:
                    chunk=stream.read(131072)
                    if not chunk:break
                    digest.update(chunk)
            require(digest.hexdigest()==item['sha256'])
            checked.add(name)
    require(checked=={name for name,item in expected.items() if item['type']=='file'})
print(json.dumps({'archive_content_verified':True,'files_verified':len(expected)}))
`;

function regularChild(output, name) {
  ensure(typeof name === 'string' && path.basename(name) === name && safePath(name) === name, 'artifact_filename_invalid');
  const filename = path.join(output, name);
  const info = fs.lstatSync(filename);
  ensure(info.isFile() && !info.isSymbolicLink() && inside(output, fs.realpathSync(filename)), 'artifact_regular_file_required');
  return filename;
}

export function verifyArtifact({ root, sourceSha, output, component, runId, runAttempt, repository,
  requireProduction = false, environment = process.env }) {
  requirePackagingRuntime();
  ensure(['client', 'server'].includes(component) && matches(sourceSha, /^[a-f0-9]{40}$/), 'artifact_identity_invalid');
  root = fs.realpathSync(root);
  output = exactOutput(root, output);
  const expectedRun = { repository: repository ?? environment.GITHUB_REPOSITORY,
    run_id: runId ?? environment.GITHUB_RUN_ID, run_attempt: runAttempt ?? environment.GITHUB_RUN_ATTEMPT };
  ensure(matches(expectedRun.repository, /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/) &&
    matches(expectedRun.run_id, /^[1-9][0-9]*$/) && matches(expectedRun.run_attempt, /^[1-9][0-9]*$/),
  'expected_artifact_run_required');
  const result = readJson(regularChild(output, 'artifact-result.json'));
  ensure(result.schema_version === 1 && result.component === component && result.source_sha === sourceSha &&
    result.build_invoked_by_packager === false && typeof result.production_eligible === 'boolean' &&
    /^[a-f0-9]{64}$/.test(result.package_tree_sha256) && result.release_id ===
      `${component === 'server' ? 'backend' : 'client'}-${sourceSha.slice(0, 12)}-${result.package_tree_sha256.slice(0, 12)}`,
  'artifact_result_identity_mismatch');
  ensure(result.archive_file === result.release_id + '.tar.gz' && result.manifest_file === result.release_id + '.manifest.json' &&
    result.metadata_file === 'build-metadata.json' &&
    ['archive_sha256', 'manifest_sha256', 'metadata_sha256'].every(key => /^[a-f0-9]{64}$/.test(result[key])),
  'artifact_result_paths_or_digests_invalid');
  const archive = regularChild(output, result.archive_file);
  const manifestFile = regularChild(output, result.manifest_file);
  const metadataFile = regularChild(output, result.metadata_file);
  ensure(digestFile(archive) === result.archive_sha256 && digestFile(manifestFile) === result.manifest_sha256 &&
    digestFile(metadataFile) === result.metadata_sha256, 'artifact_download_digest_mismatch');
  const metadata = readJson(metadataFile);
  ensure(metadata.schema_version === 1 && metadata.component === component && metadata.source_sha === sourceSha &&
    metadata.release_id === result.release_id && metadata.package_tree_sha256 === result.package_tree_sha256 &&
    metadata.archive_sha256 === result.archive_sha256 && metadata.manifest_sha256 === result.manifest_sha256 &&
    metadata.archive_file === result.archive_file && metadata.manifest_file === result.manifest_file &&
    metadata.production_eligible === result.production_eligible && metadata.build_invoked_by_packager === false &&
    JSON.stringify(result.ci) === JSON.stringify(metadata.ci) &&
    Object.entries(expectedRun).every(([key, value]) => metadata.ci?.[key] === value), 'artifact_run_metadata_mismatch');
  const manifest = readJson(manifestFile);
  ensure(manifest.source_sha === sourceSha && manifest.release_id === result.release_id &&
    manifest.package_tree_sha256 === result.package_tree_sha256 && manifest.source_provenance === 'git_archive' &&
    manifest.source?.source_sha === sourceSha && manifest.source.source_provenance === 'git_archive' &&
    manifest.source.deployment_eligible === true && Array.isArray(manifest.source.overlay) && manifest.source.overlay.length === 0 &&
    manifest.source.source_manifest_sha256 === metadata.source_manifest_sha256 &&
    manifest.source.archive_sha256 === metadata.source_archive_sha256 && manifest.deployment_eligible === true,
  'artifact_manifest_identity_mismatch');
  const calculatedEligibility = metadata.ci.event === 'push' && metadata.ci.ref === 'refs/heads/master' &&
    (component !== 'client' || metadata.required_public_configuration_valid === true);
  ensure(metadata.production_eligible === calculatedEligibility && (!requireProduction || calculatedEligibility),
    'artifact_not_production_eligible');
  if (component === 'client') {
    ensure(/^[a-f0-9]{64}$/.test(metadata.public_configuration_sha256) &&
      typeof metadata.required_public_configuration_valid === 'boolean', 'client_public_configuration_metadata_invalid');
    if (requireProduction) ensure(publicConfiguration(environment, metadata.ci).public_configuration_sha256 ===
      metadata.public_configuration_sha256, 'client_public_configuration_mismatch');
  }
  let content;
  try {
    content = JSON.parse(execFileSync('python3', ['-I', '-c', archiveReader,
      path.join(root, 'ops/production/stage-backend-candidate.py'), archive, manifestFile, component],
    { encoding: 'utf8', maxBuffer: 16_384, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch { throw new Error('artifact_archive_validation_failed'); }
  ensure(content.archive_content_verified === true && Number.isSafeInteger(content.files_verified) && content.files_verified > 0,
    'artifact_archive_validation_failed');
  return { schema_version: 1, status: 'verified', component, source_sha: sourceSha,
    release_id: result.release_id, package_tree_sha256: result.package_tree_sha256, archive_sha256: result.archive_sha256,
    ci: metadata.ci, production_eligible: metadata.production_eligible, archive_content_verified: true,
    files_verified: content.files_verified, build_invoked_by_verifier: false,
    eligibility_scope: 'Verified bytes/run identity; caller must separately trust the GitHub artifact/run and enforce global CI/rollout gates.' };
}

export function parseArguments(argv) {
  const [command, ...pairs] = argv;
  ensure(['capture', 'package', 'verify'].includes(command) && pairs.length % 2 === 0, 'artifact_arguments_invalid');
  const result = { command };
  for (let index = 0; index < pairs.length; index += 2) {
    const key = pairs[index];
    ensure(['--root', '--source-sha', '--output', '--component', '--run-id', '--run-attempt', '--repository', '--require-production'].includes(key) &&
      !Object.hasOwn(result, key), 'artifact_arguments_invalid');
    result[key] = pairs[index + 1];
  }
  ensure(['--root', '--source-sha', '--output', '--component'].every(key => typeof result[key] === 'string' && result[key]),
    'artifact_arguments_missing');
  ensure(['client', 'server'].includes(result['--component']) && matches(result['--source-sha'], /^[a-f0-9]{40}$/), 'artifact_identity_invalid');
  ensure(result['--require-production'] === undefined || ['true', 'false'].includes(result['--require-production']), 'artifact_arguments_invalid');
  ensure(command === 'verify' || !['--run-id', '--run-attempt', '--repository', '--require-production'].some(key => Object.hasOwn(result, key)),
    'artifact_arguments_invalid');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === moduleFilename) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const options = { root: args['--root'], sourceSha: args['--source-sha'], output: args['--output'], component: args['--component'] };
    const result = args.command === 'capture' ? captureSource(options) : args.command === 'package' ? packageArtifact(options) :
      verifyArtifact({ ...options, runId: args['--run-id'], runAttempt: args['--run-attempt'], repository: args['--repository'],
        requireProduction: args['--require-production'] === 'true' });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'ci_artifact_operation_failed');
    process.exitCode = 1;
  }
}
