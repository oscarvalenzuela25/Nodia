import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repository = 'oscarvalenzuela25/Nodia';
export const ZIP_LIMIT = 768 * 1024 * 1024;
export const SHA = /^[a-f0-9]{40}$/;
export const HEX = /^[a-f0-9]{64}$/;
export const numeric = value => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.exec(value)?.[0] === value;
export const isSha = value => typeof value === 'string' && value.length === 40 && SHA.test(value);
export const isHex = value => typeof value === 'string' && value.length === 64 && HEX.test(value);
export class CdRejected extends Error {}
export const requireCd = (condition, code) => { if (!condition) throw new CdRejected(code); };
export function safeFailure(error) {
  return { schema_version: 1, status: 'failed', error_code: error instanceof CdRejected ? error.message : 'cd_failed_inspect_private_state',
    automatic_retry_allowed: false };
}
export function writeState(filename, value) {
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}
export function outputs(values, environment = process.env) {
  if (!environment.GITHUB_OUTPUT) return;
  for (const [name, value] of Object.entries(values)) {
    requireCd(/^[a-z_]+$/.test(name) && typeof value === 'string' && !/[\r\n\0]/.test(value), 'unsafe_action_output');
    fs.appendFileSync(environment.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}
export function validateCiRun(run, { runId, attempt, sourceSha } = {}) {
  requireCd(numeric(runId) && numeric(attempt) && run && String(run.id) === runId && String(run.run_attempt) === attempt &&
    run.status === 'completed' && run.conclusion === 'success' && run.event === 'push' && run.head_branch === 'master' &&
    run.repository?.full_name === repository && run.head_repository?.full_name === repository &&
    run.head_repository.id === run.repository.id && run.path === '.github/workflows/ci.yml' && run.name === 'Nodia CI' &&
    isSha(run.head_sha) && (!sourceSha || run.head_sha === sourceSha), 'trusted_master_ci_run_required');
  return { run_id: runId, run_attempt: attempt, source_sha: run.head_sha, repository };
}
export function githubClient(environment = process.env, request = fetch) {
  const token = environment.GITHUB_TOKEN;
  requireCd(typeof token === 'string' && token && !/\s/.test(token), 'github_read_token_required');
  const root = `https://api.github.com/repos/${repository}/`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function get(resource) {
    requireCd(typeof resource === 'string' && !resource.startsWith('/') && !/[\r\n\\]/.test(resource), 'github_resource_invalid');
    let response;
    try { response = await request(root + resource, { headers, redirect: 'error', signal: AbortSignal.timeout(20_000) }); }
    catch { throw new CdRejected('github_read_failed'); }
    requireCd(response.ok, 'github_read_failed');
    let value;
    try {
      const bytes = await response.arrayBuffer();
      requireCd(bytes.byteLength <= 4 * 1024 * 1024, 'github_json_limit');
      value = JSON.parse(Buffer.from(bytes).toString('utf8'));
    } catch (error) { if (error instanceof CdRejected) throw error; throw new CdRejected('github_json_invalid'); }
    return value;
  }
  async function gate(runId, attempt, sourceSha) {
    const value = validateCiRun(await get(`actions/runs/${runId}`), { runId, attempt, sourceSha });
    const current = await get('git/ref/heads/master');
    requireCd(current.ref === 'refs/heads/master' && current.object?.type === 'commit' && current.object.sha === value.source_sha,
      'ci_source_is_not_current_master');
    return value;
  }
  async function artifacts(ci) {
    const found = [];
    for (let page = 1; page <= 10; page++) {
      const value = await get(`actions/runs/${ci.run_id}/artifacts?per_page=100&page=${page}`);
      requireCd(Number.isInteger(value.total_count) && value.total_count <= 1000 && Array.isArray(value.artifacts), 'artifact_list_invalid');
      found.push(...value.artifacts);
      if (found.length >= value.total_count) return found;
    }
    throw new CdRejected('artifact_list_incomplete');
  }
  async function download(artifact, filename) {
    requireCd(numeric(String(artifact.id)) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest), 'official_artifact_digest_required');
    let redirect;
    try { redirect = await request(root + `actions/artifacts/${artifact.id}/zip`, {
      headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) }); }
    catch { throw new CdRejected('artifact_download_failed'); }
    requireCd(redirect.status === 302, 'artifact_download_redirect_required');
    let location;
    try { location = new URL(redirect.headers.get('location')); }
    catch { throw new CdRejected('artifact_download_location_invalid'); }
    requireCd(location.protocol === 'https:' && !location.username && !location.password && !location.port &&
      (location.hostname.endsWith('.blob.core.windows.net') || location.hostname.endsWith('.actions.githubusercontent.com')),
    'artifact_download_location_invalid');
    let response;
    try { response = await request(location, { redirect: 'error', signal: AbortSignal.timeout(120_000) }); }
    catch { throw new CdRejected('artifact_download_failed'); }
    requireCd(response.status === 200 && response.body, 'artifact_download_failed');
    const descriptor = fs.openSync(filename, 'wx', 0o600);
    let bytes = 0;
    const digest = createHash('sha256');
    let verified = false;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        requireCd(bytes <= ZIP_LIMIT, 'artifact_zip_limit');
        digest.update(chunk);
        let written = 0;
        while (written < chunk.byteLength) written += fs.writeSync(descriptor, chunk, written, chunk.byteLength - written);
      }
      fs.fsyncSync(descriptor);
      const actual = digest.digest('hex');
      requireCd(bytes > 0 && `sha256:${actual}` === artifact.digest, 'official_artifact_zip_digest_mismatch');
      verified = true;
      return { bytes, sha256: actual };
    } catch (error) {
      if (error instanceof CdRejected) throw error;
      throw new CdRejected('artifact_download_failed');
    } finally {
      fs.closeSync(descriptor);
      if (!verified) fs.unlinkSync(filename);
    }
  }
  return { get, gate, artifacts, download };
}

export function selectArtifact(artifacts, component, ci, { required = true } = {}) {
  requireCd(['client', 'server'].includes(component), 'artifact_component_invalid');
  const name = `${component}-${ci.source_sha}-${ci.run_id}-${ci.run_attempt}`;
  const matches = artifacts.filter(item => item.name === name);
  requireCd(matches.length <= 1, 'ambiguous_component_artifact');
  if (!matches.length) { requireCd(!required, 'required_component_artifact_missing'); return null; }
  const artifact = matches[0];
  requireCd(artifact.expired === false && numeric(String(artifact.id)) && typeof artifact.digest === 'string' &&
    /^sha256:[a-f0-9]{64}$/.exec(artifact.digest)?.[0] === artifact.digest &&
    Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= ZIP_LIMIT &&
    String(artifact.workflow_run?.id) === ci.run_id && artifact.workflow_run.head_sha === ci.source_sha &&
    artifact.workflow_run.head_branch === 'master', 'official_artifact_source_invalid');
  return { id: String(artifact.id), digest: artifact.digest, name, size_in_bytes: artifact.size_in_bytes,
    workflow_run: artifact.workflow_run, expired: false };
}

const extractZip = String.raw`
import json,pathlib,re,stat,sys,zipfile
source,directory,component,sha=sys.argv[1:]
out=pathlib.Path(directory)
if out.exists():raise ValueError('output_exists')
out.mkdir(mode=0o700)
with zipfile.ZipFile(source) as archive:
    entries=archive.infolist()
    if len(entries)!=4 or len({item.filename for item in entries})!=4:raise ValueError('zip_inventory')
    names={item.filename for item in entries}
    prefix='backend' if component=='server' else 'client'
    pattern=prefix+'-'+sha[:12]+r'-[a-f0-9]{12}'
    tar=[name for name in names if re.fullmatch(pattern+r'\.tar\.gz',name)]
    if len(tar)!=1:raise ValueError('zip_release')
    release=tar[0][:-7]
    if names!={'artifact-result.json','build-metadata.json',tar[0],release+'.manifest.json'}:raise ValueError('zip_inventory')
    total=0
    for entry in entries:
        kind=stat.S_IFMT(entry.external_attr>>16)
        if entry.is_dir() or kind not in (0,stat.S_IFREG) or entry.flag_bits&1 or entry.compress_type not in (0,8):raise ValueError('zip_type')
        limit=65536 if entry.filename in ('artifact-result.json','build-metadata.json') else 16777216 if entry.filename.endswith('.manifest.json') else 1073741824
        total+=entry.file_size
        if not 0<entry.file_size<=limit or total>1100000000:raise ValueError('zip_size')
        with archive.open(entry) as stream,(out/entry.filename).open('xb') as target:
            count=0
            while True:
                chunk=stream.read(131072)
                if not chunk:break
                count+=len(chunk)
                if count>limit:raise ValueError('zip_size')
                target.write(chunk)
            if count!=entry.file_size:raise ValueError('zip_size')
print(json.dumps({'status':'extracted','files':4}))
`;
export function extractOriginalZip(archive, output, component, sourceSha) {
  requireCd(['client', 'server'].includes(component) && isSha(sourceSha), 'artifact_identity_invalid');
  try { execFileSync('python3', ['-I', '-c', extractZip, archive, output, component, sourceSha], {
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000, maxBuffer: 16_384 }); }
  catch { throw new CdRejected('official_zip_validation_failed'); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireCd(process.argv[2] === 'gate' && numeric(process.env.CI_RUN_ID) && numeric(process.env.CI_RUN_ATTEMPT), 'ci_run_input_required');
    const result = await githubClient().gate(process.env.CI_RUN_ID, process.env.CI_RUN_ATTEMPT);
    outputs({ source_sha: result.source_sha, run_id: result.run_id, run_attempt: result.run_attempt });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
