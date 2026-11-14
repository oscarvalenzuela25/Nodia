import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inventory } from '../production/package-backend-release.mjs';
import { verifyProject } from './check-pages-access.mjs';
import { forbiddenPackagePath, publicConfiguration } from './artifact-release.mjs';
import { CdRejected, isHex, isSha, numeric, outputs, requireCd, safeFailure, writeState } from './cd-github.mjs';
import { validatePwaAssets } from './pwa-assets.mjs';

const sourceRequire = createRequire(new URL('./pages-assets/package.json', import.meta.url));
const responseLimit = 2 * 1024 * 1024;
async function responseBytes(response, operation) {
  const declared = response.headers.get('content-length');
  requireCd(declared === null || /^\d+$/.test(declared) && Number(declared) <= responseLimit,
    `pages_response_limit_${operation}`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = [];
  let length = 0, complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      length += value.length;
      requireCd(length <= responseLimit, `pages_response_limit_${operation}`);
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { if (!complete) await reader.cancel(); reader.releaseLock(); }
}
function errorCodes(body) {
  if (!Array.isArray(body?.errors)) return '';
  const codes = [...new Set(body.errors.map(error => error?.code)
    .filter(code => Number.isSafeInteger(code) && code >= 0 && code <= 999999999))].slice(0, 3);
  return codes.length ? '_cf_' + codes.join('_') : '';
}
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
    // Fixed labels identify the failed request without exposing URLs, credentials or response bodies.
    const operation = resource === projectPath ? 'project' :
      resource.startsWith(`${projectPath}/deployments?`) ? 'deployment_history' :
      resource === `${projectPath}/upload-token` ? 'upload_token' :
      resource === `${projectPath}/deployments` ? 'deployment_submit' :
      resource.startsWith(`${projectPath}/deployments/`) ? 'deployment_status' :
      resource === '/pages/assets/check-missing' ? 'asset_check' :
      resource === '/pages/assets/upload' ? 'asset_upload' :
      resource === '/pages/assets/upsert-hashes' ? 'asset_registration' : 'other';
    const headers = { Authorization: `Bearer ${jwt ?? token}`, Accept: 'application/json' };
    let payload = body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const write = method !== 'GET' && operation !== 'asset_check';
    let response;
    try { response = await request('https://api.cloudflare.com/client/v4' + resource, {
      method, headers, body: payload, redirect: 'error', signal: AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000) }); }
    catch { throw new CdRejected(`${write ? 'pages_write_outcome_unknown' : 'pages_read_failed'}_${operation}_transport`); }
    let bytes;
    try { bytes = await responseBytes(response, operation); }
    catch (error) { if (error instanceof CdRejected) throw error;
      throw new CdRejected(`${write ? 'pages_write_outcome_unknown' : 'pages_read_failed'}_${operation}_body_transport`); }
    const acknowledgement = ['asset_upload', 'asset_registration'].includes(operation);
    // Cloudflare's SDK treats empty 204/205 as acknowledgements. Never allow an empty lookup or deployment identity.
    if (acknowledgement && [204, 205].includes(response.status) && bytes.length === 0)
      return { success: true, result: null };
    let value = null;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { /* Report only fixed labels, never a remote body. */ }
    requireCd(response.ok, `${write ? 'pages_write_failed_or_outcome_unknown' : 'pages_read_failed'}_${operation}_http_${response.status}${errorCodes(value)}`);
    requireCd(value && typeof value === 'object' && !Array.isArray(value), `pages_response_invalid_${operation}_http_${response.status}`);
    // Asset endpoints legitimately omit errors on success; a present errors field must still be an empty array.
    requireCd(value.success === true && (!Object.hasOwn(value, 'errors') || Array.isArray(value.errors) && value.errors.length === 0),
      `pages_response_unsuccessful_${operation}_http_${response.status}${errorCodes(value)}`);
    requireCd(acknowledgement || Object.hasOwn(value, 'result'), `pages_result_missing_${operation}`);
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
  validatePwaAssets(directory);
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
function publicationContext(environment, metadata, request) {
  requireCd(environment.GITHUB_EVENT_NAME === 'workflow_dispatch' && environment.GITHUB_REF === 'refs/heads/master' &&
    environment.GITHUB_RUN_ATTEMPT === '1', 'pages_cd_rerun_requires_reconciliation');
  const client = pagesClient(environment, request);
  const desired = deploymentMarker(metadata);
  const config = publicConfiguration(environment, { event: 'push', ref: 'refs/heads/master' });
  requireCd(metadata.production_eligible === true && metadata.required_public_configuration_valid === true &&
    metadata.public_configuration_sha256 === config.public_configuration_sha256, 'pages_public_configuration_mismatch');
  return { client, desired };
}
async function deploymentTarget(environment, metadata, expectedBaseline, request, client, desired) {
  const current = await readPages(environment, { request });
  if (current.recorded_marker === desired) {
    requireCd(current.source_sha === metadata.source_sha, 'pages_marker_source_mismatch');
    return { current, alreadyCurrent: true, deployment: null };
  }
  requireCd(!expectedBaseline || current.source_sha === expectedBaseline.source_sha &&
    current.deployment_id === expectedBaseline.deployment_id, 'pages_baseline_changed_after_plan');
  const matches = [];
  // Pages rejected 100 with HTTP 400/8000024; 25 was verified against the live API.
  // Keep the previous 2,000-entry bound and require a terminal page before any write.
  const pageSize = 25, pageLimit = 80;
  for (let page = 1; page <= pageLimit; page++) {
    const listing = await client.api(`${client.projectPath}/deployments?env=production&per_page=${pageSize}&page=${page}`);
    requireCd(Array.isArray(listing.result) && listing.result.length <= pageSize, 'pages_deployment_list_invalid');
    matches.push(...listing.result.filter(value => value.deployment_trigger?.metadata?.commit_message === desired));
    if (listing.result.length < pageSize) break;
    requireCd(page < pageLimit, 'pages_deployment_history_incomplete');
  }
  requireCd(matches.length <= 1, 'ambiguous_pages_deployment_marker');
  const deployment = matches.length ? validateDeployment(matches[0], { sourceSha: metadata.source_sha, marker: desired }) : null;
  if (deployment) requireCd(deployment.latest_stage.name === 'deploy' && deployment.latest_stage.status === 'success',
    'existing_pages_deployment_requires_reconciliation');
  return { current, alreadyCurrent: false, deployment };
}
async function missingAssets(client, content) {
  const token = (await client.api(`${client.projectPath}/upload-token`)).result?.jwt;
  requireCd(typeof token === 'string' && token && !/\s/.test(token), 'pages_upload_token_invalid');
  const missing = (await client.api('/pages/assets/check-missing', { method: 'POST', jwt: token,
    body: { hashes: [...content.assets.keys()] } })).result;
  requireCd(Array.isArray(missing) && new Set(missing).size === missing.length && missing.every(hash => content.assets.has(hash)), 'pages_missing_hashes_invalid');
  return { token, missing };
}
export async function preflightPages({ environment = process.env, metadata, directory, allowCreate, expectedBaseline, stateFile,
  request = fetch, tools, revalidate = async () => {} }) {
  const { client, desired } = publicationContext(environment, metadata, request);
  const content = await staticAssets(directory, tools);
  const base = { source_sha: metadata.source_sha, pages_marker: desired, total_assets: content.assets.size,
    missing_assets: null, asset_check_performed: false, deployment_requested: false, asset_upload_requested: false,
    automatic_retry_allowed: false };
  const record = value => { if (stateFile) writeState(stateFile, { ...base, ...value }); };
  record({ status: 'preflight_started' });
  await revalidate();
  const target = await deploymentTarget(environment, metadata, expectedBaseline, request, client, desired);
  let result;
  if (target.alreadyCurrent) result = { ...base, deployment_id: target.current.deployment_id };
  else if (target.deployment) {
    const current = await readPages(environment, { request });
    requireCd(current.deployment_id === target.deployment.id && current.recorded_marker === desired, 'pages_canonical_version_mismatch');
    result = { ...base, deployment_id: current.deployment_id };
  } else {
    requireCd(allowCreate === true, 'prior_cd_pages_outcome_requires_reconciliation');
    record({ status: 'asset_check_requested' });
    const { missing } = await missingAssets(client, content);
    result = { ...base, missing_assets: missing.length, asset_check_performed: true };
  }
  await revalidate();
  record({ ...result, status: 'preflight_verified' });
  return { ...result, status: 'preflight_verified' };
}
export async function publishPages({ environment = process.env, metadata, directory, allowCreate, expectedBaseline, stateFile,
  request = fetch, tools, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), pollLimit = 120, revalidate = async () => {} }) {
  const { client, desired } = publicationContext(environment, metadata, request);
  const record = value => { if (stateFile) writeState(stateFile, { marker: desired, automatic_retry_allowed: false, ...value }); };
  const target = await deploymentTarget(environment, metadata, expectedBaseline, request, client, desired);
  if (target.alreadyCurrent) {
    record({ status: 'already_current', deployment_requested: false, deployment_id: target.current.deployment_id });
    return { status: 'already_current', source_sha: metadata.source_sha, deployment_id: target.current.deployment_id, deployment_requested: false };
  }
  let deployment = target.deployment;
  if (!deployment) {
    requireCd(allowCreate === true, 'prior_cd_pages_outcome_requires_reconciliation');
    const content = await staticAssets(directory, tools);
    await revalidate();
    record({ status: 'asset_check_requested', deployment_requested: false });
    const { token, missing } = await missingAssets(client, content);
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
