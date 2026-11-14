// Public, bounded evidence only. This receipt never authorizes a replay or stores transport credentials.
import fs from 'node:fs';
import path from 'node:path';
import { isHex, isSha, numeric, repository } from './cd-github.mjs';

const statusValues = new Set(['baseline_verified', 'prepared', 'preflight_started', 'preflight_verified', 'not_required', 'already_current',
  'upload_requested', 'deployment_requested', 'submitted', 'complete', 'failed', 'unknown',
  'asset_check_requested', 'asset_upload_requested', 'asset_hash_registration_requested',
  'pages_submission_requested', 'published_assets_verification_failed']);
const fixedErrors = new Set(['cd_failed_inspect_private_state', 'pages_response_unsuccessful', 'pages_response_invalid',
  'pages_response_limit', 'client_preflight_required_before_backend', 'client_preflight_identity_mismatch',
  'client_preflight_result_invalid', 'client_static_changed_after_preflight', 'static_extract_already_exists',
  'verified_client_extract_failed', 'backend_must_be_confirmed_before_pages', 'backend_changed_after_plan',
  'backend_operation_requires_reconciliation', 'backend_operation_poll_deadline_requires_reconciliation',
  'backend_submission_outcome_unknown', 'backend_upload_outcome_unknown', 'backend_poll_outcome_unknown',
  'prior_cd_run_requires_operator_reconciliation', 'prior_cd_pages_outcome_requires_reconciliation',
  'pages_status_deadline_requires_reconciliation', 'existing_pages_deployment_requires_reconciliation',
  'pages_baseline_changed_after_plan', 'pages_canonical_version_mismatch', 'pages_deployment_failed_requires_reconciliation',
  'pages_deployment_history_incomplete', 'ambiguous_pages_deployment_marker', 'pages_public_configuration_mismatch',
  'pages_upload_token_invalid', 'pages_missing_hashes_invalid', 'trusted_cd_dispatch_required',
  'ci_source_is_not_current_master', 'trusted_master_ci_run_required', 'github_read_failed',
  'pwa_public_assets_verification_failed', 'pages_write_outcome_unknown']);
const pagesOperation = '(?:project|deployment_history|upload_token|deployment_submit|deployment_status|asset_check|asset_upload|asset_registration)';
const pagesHttp = 'http_[1-5][0-9]{2}(?:_cf_[0-9]{1,9}(?:_[0-9]{1,9}){0,2})?';
const pagesError = new RegExp('^pages_(?:(?:read_failed|write_failed_or_outcome_unknown|write_outcome_unknown)_' +
  pagesOperation + '_(?:transport|body_transport|' + pagesHttp + ')|response_(?:invalid|unsuccessful)_' +
  pagesOperation + '_' + pagesHttp + '|(?:response_limit|result_missing)_' + pagesOperation + ')$');
export function receiptError(value) {
  return typeof value === 'string' && (fixedErrors.has(value) ||
    pagesError.test(value) ||
    /^pwa_public_asset_(?:request_failed|status_invalid|mime_invalid|body_missing|size_invalid|digest_mismatch)$/.test(value))
    ? value : 'cd_failed_inspect_private_state';
}
const marker = value => typeof value === 'string' &&
  /^nodia-ci:[a-f0-9]{40}:[a-f0-9]{64}:[a-f0-9]{64}:[1-9][0-9]{0,19}:[1-9][0-9]{0,19}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const release = value => typeof value === 'string' && /^(?:backend|client)-[a-f0-9]{12}-[a-f0-9]{12}$/.test(value);
function state(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = { status: statusValues.has(value.status) ? value.status : 'not_confirmed' };
  for (const [key, valid] of Object.entries({ source_sha: isSha, package_tree_sha256: isHex,
    release_id: release, deployment_id: uuid,
    operation_id: item => typeof item === 'string' && /^[a-f0-9]{32}$/.test(item),
    pages_marker: marker, marker, recorded_marker: marker })) {
    if (valid(value[key])) result[key] = value[key];
  }
  for (const key of ['deployment_requested', 'deployment_performed', 'effects_started', 'migration_requested',
    'asset_upload_requested', 'asset_check_performed', 'pwa_assets_verified']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const key of ['total_assets', 'missing_assets', 'pwa_assets_count']) {
    if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 20_000) result[key] = value[key];
    else if (value[key] === null) result[key] = null;
  }
  if (Object.hasOwn(value, 'error_code')) result.error_code = receiptError(value.error_code);
  result.automatic_retry_allowed = false;
  return result;
}
function artifact(value) {
  if (!value || typeof value !== 'object') return null;
  const result = {};
  if (numeric(value.id)) result.id = value.id;
  if (typeof value.digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.digest)) result.digest = value.digest;
  for (const key of ['package_tree_sha256', 'public_configuration_sha256']) {
    if (isHex(value.metadata?.[key])) result[key] = value.metadata[key];
  }
  if (release(value.result?.release_id)) result.release_id = value.result.release_id;
  return result;
}
export function deliveryReceipt(directory, environment = process.env) {
  const unavailable = [];
  const read = name => {
    const filename = path.join(directory, name);
    if (!fs.existsSync(filename)) return null;
    try {
      const info = fs.lstatSync(filename);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) throw new Error();
      const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value;
    } catch { unavailable.push(name); return null; }
  };
  const plan = read('release-plan.json'), serverBase = read('server-baseline.json'), clientBase = read('client-baseline.json');
  const backendState = read('backend-state.json'), backendResult = read('backend-result.json');
  const pagesState = read('pages-state.json'), clientResult = read('client-result.json');
  const preflightState = read('pages-preflight-state.json'), preflightResult = read('client-preflight.json');
  const failure = read('failure.json');
  return { schema_version: 1, repository, source_sha: isSha(plan?.source_sha) ? plan.source_sha :
    isSha(environment.CI_SOURCE_SHA) ? environment.CI_SOURCE_SHA : null,
  ci: { run_id: numeric(environment.CI_RUN_ID) ? environment.CI_RUN_ID : null,
    run_attempt: numeric(environment.CI_RUN_ATTEMPT) ? environment.CI_RUN_ATTEMPT : null },
  delivery: { run_id: numeric(environment.GITHUB_RUN_ID) ? environment.GITHUB_RUN_ID : null,
    run_attempt: numeric(environment.GITHUB_RUN_ATTEMPT) ? environment.GITHUB_RUN_ATTEMPT : null },
  prior_cd_run: ['true', 'false'].includes(environment.CD_PRIOR_RUN) ? environment.CD_PRIOR_RUN === 'true' : null,
  baselines: { client: state(plan?.client_baseline ?? clientBase), server: state(plan?.server_baseline ?? serverBase?.current) },
  artifacts: { client: artifact(plan?.artifacts?.client), server: artifact(plan?.artifacts?.server) },
  preflight: state(preflightResult ?? preflightState),
  backend: state(backendResult ? { ...backendState, ...backendResult } : backendState),
  client: state(clientResult ? { ...pagesState, ...clientResult } : pagesState ?? preflightResult ?? preflightState),
  failure: failure ? { status: 'failed', error_code: receiptError(failure.error_code), automatic_retry_allowed: false } : null,
  unavailable_sources: unavailable, automatic_retry_allowed: false };
}
