import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inventory } from '../production/package-backend-release.mjs';
import { verifyProject } from './check-pages-access.mjs';
import { forbiddenPackagePath, publicConfiguration } from './artifact-release.mjs';
import { CdRejected, isHex, isSha, numeric, outputs, requireCd, safeFailure, writeState } from './cd-github.mjs';

const sourceRequire = createRequire(new URL('./pages-assets/package.json', import.meta.url));
export async function assetTools() {
  const blake = sourceRequire('blake3-wasm');
  const mime = (await import(pathToFileURL(sourceRequire.resolve('mime')).href)).default;
  return { hash: (bytes, filename) => blake.hash(bytes.toString('base64') + path.extname(filename).slice(1)).toString('hex').slice(0, 32),
    contentType: filename => mime.getType(filename) ?? 'application/octet-stream' };
}
export function pagesClient(environment = process.env, request = fetch) {
  requireCd(['push', 'workflow_dispatch'].includes(environment.GITHUB_EVENT_NAME) && environment.GITHUB_REF === 'refs/heads/master',
    'trusted_master_pages_context_required');
  const account = environment.CLOUDFLARE_ACCOUNT_ID, project = environment.CLOUDFLARE_PAGES_PROJECT_NAME;
  const token = environment.CLOUDFLARE_API_TOKEN;
  requireCd(typeof account === 'string' && account.length === 32 && /^[a-f0-9]{32}$/i.test(account) && project === 'nodia' &&
    typeof token === 'string' && token && !/\s/.test(token), 'pages_credentials_or_destination_invalid');
  const projectPath = `/accounts/${account}/pages/projects/nodia`;
  async function api(resource, { method = 'GET', body, jwt } = {}) {
    requireCd(resource.startsWith(projectPath + '/') || resource === projectPath || resource.startsWith('/pages/assets/'),
      'pages_api_resource_invalid');
    const headers = { Authorization: `Bearer ${jwt ?? token}`, Accept: 'application/json' };
    let payload = body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let response;
    try { response = await request('https://api.cloudflare.com/client/v4' + resource, {
      method, headers, body: payload, redirect: 'error', signal: AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000) }); }
    catch { throw new CdRejected(method === 'GET' ? 'pages_read_failed' : 'pages_write_outcome_unknown'); }
    requireCd(response.ok, method === 'GET' ? 'pages_read_failed' : 'pages_write_failed_or_outcome_unknown');
    let value;
    try {
      const bytes = await response.arrayBuffer();
      requireCd(bytes.byteLength <= 2 * 1024 * 1024, 'pages_response_limit');
      value = JSON.parse(Buffer.from(bytes).toString('utf8'));
    } catch (error) { if (error instanceof CdRejected) throw error; throw new CdRejected('pages_response_invalid'); }
    requireCd(value?.success === true && Array.isArray(value.errors) && value.errors.length === 0, 'pages_response_unsuccessful');
    return value;
  }
  return { api, projectPath };
}
export function deploymentMarker(metadata) {
  requireCd(isSha(metadata.source_sha) && isHex(metadata.package_tree_sha256) && isHex(metadata.public_configuration_sha256) &&
    numeric(metadata.ci?.run_id) && numeric(metadata.ci?.run_attempt), 'pages_artifact_metadata_invalid');
  return `nodia-ci:${metadata.source_sha}:${metadata.package_tree_sha256}:${metadata.public_configuration_sha256}:${metadata.ci.run_id}:${metadata.ci.run_attempt}`;
}
export function validateDeployment(value, { sourceSha, marker } = {}) {
  requireCd(value && typeof value.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id) && value.environment === 'production' &&
    isSha(value.deployment_trigger?.metadata?.commit_hash) && value.deployment_trigger.metadata.branch === 'master' &&
    (!sourceSha || value.deployment_trigger.metadata.commit_hash === sourceSha) &&
    (!marker || value.deployment_trigger.metadata.commit_message === marker) && value.latest_stage &&
    typeof value.latest_stage.name === 'string' && typeof value.latest_stage.status === 'string', 'pages_deployment_identity_invalid');
  return value;
}
export async function readPages(environment = process.env, { request = fetch } = {}) {
  const client = pagesClient(environment, request);
  const body = await client.api(client.projectPath);
  try { verifyProject(body, 'nodia'); } catch { throw new CdRejected('recorded_pages_project_settings_mismatch'); }
  const deployment = validateDeployment(body.result.canonical_deployment);
  requireCd(deployment.latest_stage.name === 'deploy' && deployment.latest_stage.status === 'success', 'canonical_pages_deployment_not_successful');
  const marker = deployment.deployment_trigger.metadata.commit_message;
  const match = typeof marker === 'string' && /^nodia-ci:([a-f0-9]{40}):([a-f0-9]{64}):([a-f0-9]{64}):([1-9][0-9]*):([1-9][0-9]*)$/.exec(marker);
  requireCd(!match || match[1] === deployment.deployment_trigger.metadata.commit_hash, 'pages_marker_source_mismatch');
  const configuration = publicConfiguration(environment, { event: 'push', ref: 'refs/heads/master' });
  return { schema_version: 1, status: 'baseline_verified', source_sha: deployment.deployment_trigger.metadata.commit_hash,
    deployment_id: deployment.id, config_changed: !match || match[3] !== configuration.public_configuration_sha256,
    recorded_marker: match ? marker : null, deployment_requested: false };
}
export async function staticAssets(directory, tools) {
  tools ??= await assetTools();
  requireCd(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(), 'static_dist_required');
  const files = inventory(directory, { source: true });
  requireCd(files.length > 0 && files.length <= 20_000 && files.some(item => item.path === 'index.html'), 'pages_static_file_count_invalid');
  const manifest = {}, assets = new Map(), special = {};
  for (const item of files) {
    requireCd(!forbiddenPackagePath(item.path), 'operational_data_in_static_dist');
    requireCd(!item.path.split('/').some(part => ['functions', '_worker.js', '_worker.bundle', '_routes.json',
      'wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].includes(part)), 'pages_functions_or_config_not_allowed');
    requireCd(item.bytes <= 25 * 1024 * 1024, 'pages_static_asset_limit');
    const filename = path.join(directory, item.path);
    if (['_headers', '_redirects'].includes(item.path)) { special[item.path] = filename; continue; }
    const hash = tools.hash(fs.readFileSync(filename), item.path);
    requireCd(typeof hash === 'string' && /^[a-f0-9]{32}$/.test(hash), 'pages_asset_hash_invalid');
    manifest['/' + item.path] = hash;
    if (!assets.has(hash)) assets.set(hash, { hash, filename, bytes: item.bytes, contentType: tools.contentType(item.path) });
  }
  return { manifest, assets, special };
}
export async function publishPages({ environment = process.env, metadata, directory, allowCreate, expectedBaseline, stateFile,
  request = fetch, tools, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), pollLimit = 120, revalidate = async () => {} }) {
  requireCd(environment.GITHUB_EVENT_NAME === 'workflow_dispatch' && environment.GITHUB_REF === 'refs/heads/master' &&
    environment.GITHUB_RUN_ATTEMPT === '1', 'pages_cd_rerun_requires_reconciliation');
  const client = pagesClient(environment, request);
  const desired = deploymentMarker(metadata);
  const config = publicConfiguration(environment, { event: 'push', ref: 'refs/heads/master' });
  requireCd(metadata.production_eligible === true && metadata.required_public_configuration_valid === true &&
    metadata.public_configuration_sha256 === config.public_configuration_sha256, 'pages_public_configuration_mismatch');
  const record = value => { if (stateFile) writeState(stateFile, { marker: desired, automatic_retry_allowed: false, ...value }); };
  const current = await readPages(environment, { request });
  if (current.recorded_marker === desired) {
    requireCd(current.source_sha === metadata.source_sha, 'pages_marker_source_mismatch');
    record({ status: 'already_current', deployment_requested: false, deployment_id: current.deployment_id });
    return { status: 'already_current', source_sha: metadata.source_sha, deployment_id: current.deployment_id, deployment_requested: false };
  }
  requireCd(!expectedBaseline || current.source_sha === expectedBaseline.source_sha &&
    current.deployment_id === expectedBaseline.deployment_id, 'pages_baseline_changed_after_plan');
  const matches = [];
  for (let page = 1; page <= 20; page++) {
    const listing = await client.api(`${client.projectPath}/deployments?env=production&per_page=100&page=${page}`);
    requireCd(Array.isArray(listing.result), 'pages_deployment_list_invalid');
    matches.push(...listing.result.filter(value => value.deployment_trigger?.metadata?.commit_message === desired));
    if (listing.result.length < 100) break;
    requireCd(page < 20, 'pages_deployment_history_incomplete');
  }
  requireCd(matches.length <= 1, 'ambiguous_pages_deployment_marker');
  let deployment = matches.length ? validateDeployment(matches[0], { sourceSha: metadata.source_sha, marker: desired }) : null;
  if (deployment) requireCd(deployment.latest_stage.name === 'deploy' && deployment.latest_stage.status === 'success',
    'existing_pages_deployment_requires_reconciliation');
  if (!deployment) {
    requireCd(allowCreate === true, 'prior_cd_pages_outcome_requires_reconciliation');
    const content = await staticAssets(directory, tools);
    await revalidate();
    const token = (await client.api(`${client.projectPath}/upload-token`)).result?.jwt;
    requireCd(typeof token === 'string' && token && !/\s/.test(token), 'pages_upload_token_invalid');
    record({ status: 'asset_check_requested', deployment_requested: false });
    const missing = (await client.api('/pages/assets/check-missing', { method: 'POST', jwt: token,
      body: { hashes: [...content.assets.keys()] } })).result;
    requireCd(Array.isArray(missing) && new Set(missing).size === missing.length && missing.every(hash => content.assets.has(hash)), 'pages_missing_hashes_invalid');
    let bucket = [], bytes = 0;
    async function flush() {
      if (!bucket.length) return;
      record({ status: 'asset_upload_requested', deployment_requested: false });
      await client.api('/pages/assets/upload', { method: 'POST', jwt: token, body: bucket });
      bucket = []; bytes = 0;
    }
    for (const hash of missing) {
      const asset = content.assets.get(hash);
      const value = fs.readFileSync(asset.filename).toString('base64');
      if (bucket.length && (bytes + value.length > 40 * 1024 * 1024 || bucket.length >= 1000)) await flush();
      bucket.push({ key: hash, value, metadata: { contentType: asset.contentType }, base64: true });
      bytes += value.length;
    }
    await flush();
    record({ status: 'asset_hash_registration_requested', deployment_requested: false });
    await client.api('/pages/assets/upsert-hashes', { method: 'POST', jwt: token, body: { hashes: [...content.assets.keys()] } });
    const form = new FormData();
    form.set('manifest', JSON.stringify(content.manifest)); form.set('branch', 'master');
    form.set('commit_hash', metadata.source_sha); form.set('commit_message', desired); form.set('commit_dirty', 'false');
    for (const [name, filename] of Object.entries(content.special)) form.set(name, new Blob([fs.readFileSync(filename)]), name);
    await revalidate();
    record({ status: 'pages_submission_requested', deployment_requested: true });
    deployment = validateDeployment((await client.api(`${client.projectPath}/deployments`, { method: 'POST', body: form })).result,
      { sourceSha: metadata.source_sha, marker: desired });
    record({ status: 'submitted', deployment_requested: true, deployment_id: deployment.id });
  }
  for (let index = 0; index < pollLimit; index++) {
    requireCd(!['failure', 'canceled'].includes(deployment.latest_stage.status), 'pages_deployment_failed_requires_reconciliation');
    if (deployment.latest_stage.name === 'deploy' && deployment.latest_stage.status === 'success') {
      const final = await readPages(environment, { request });
      requireCd(final.deployment_id === deployment.id && final.recorded_marker === desired, 'pages_canonical_version_mismatch');
      record({ status: 'complete', deployment_requested: true, deployment_id: deployment.id });
      return { status: 'complete', source_sha: metadata.source_sha, deployment_id: deployment.id, deployment_requested: true };
    }
    await sleep(5_000);
    deployment = validateDeployment((await client.api(`${client.projectPath}/deployments/${deployment.id}`)).result,
      { sourceSha: metadata.source_sha, marker: desired });
  }
  throw new CdRejected('pages_status_deadline_requires_reconciliation');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireCd(process.argv[2] === 'baseline', 'pages_command_invalid');
    const result = await readPages();
    outputs({ source_sha: result.source_sha, config_changed: String(result.config_changed) });
    if (process.env.CD_STATE_FILE) writeState(process.env.CD_STATE_FILE, result);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
