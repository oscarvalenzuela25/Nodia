import { pathToFileURL } from 'node:url';

class PagesCheckError extends Error {}
const requireValue = (condition, code) => {
  if (!condition) throw new PagesCheckError(code);
};

export function readConfiguration(environment) {
  requireValue(environment.GITHUB_EVENT_NAME === 'workflow_dispatch', 'manual_event_required');
  requireValue(environment.GITHUB_REF === 'refs/heads/master', 'master_branch_required');
  const account = environment.CLOUDFLARE_ACCOUNT_ID;
  const project = environment.CLOUDFLARE_PAGES_PROJECT_NAME;
  const token = environment.CLOUDFLARE_API_TOKEN;
  requireValue(typeof account === 'string' && /^[a-f0-9]{32}$/i.test(account), 'account_id_invalid_or_missing');
  requireValue(project === 'nodia', 'recorded_project_name_required');
  requireValue(typeof token === 'string' && token.length > 0 && !/\s/.test(token), 'api_token_invalid_or_missing');
  return { account, project, token };
}

export function verifyProject(body, project) {
  requireValue(body?.success === true && Array.isArray(body.errors) && body.errors.length === 0,
    'cloudflare_response_unsuccessful');
  const result = body.result;
  requireValue(result?.name === project && result.subdomain === 'nodia-1ge.pages.dev',
    'recorded_project_destination_mismatch');
  requireValue(result.production_branch === 'master', 'pages_production_branch_mismatch');
  // This preflight describes the existing Git-integrated Nodia project. Unknown
  // settings are not treated as disabled; never print the project response/env_vars.
  const source = result.source;
  requireValue(source?.type === 'github', 'recorded_github_integration_missing');
  requireValue(source.config?.production_branch === 'master', 'source_production_branch_mismatch');
  requireValue(source.config.production_deployments_enabled === false, 'native_auto_deploy_not_disabled');
  requireValue(source.config.preview_deployment_setting === 'none', 'native_previews_not_disabled');
  return {
    schema_version: 1,
    status: 'read_access_verified',
    recorded_destination_matched: true,
    production_branch_master: true,
    native_auto_deploy_disabled: true,
    native_previews_disabled: true,
    write_permission_verified: false,
    deployment_requested: false,
    builds_executed: 0,
    vps_accessed: false,
  };
}

export async function checkPagesAccess(environment, { request = fetch } = {}) {
  const { account, project, token } = readConfiguration(environment);
  let response;
  try {
    response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Fetch errors and remote messages can contain confidential request details.
    throw new PagesCheckError('cloudflare_network_or_timeout_error');
  }
  requireValue(response.ok, 'cloudflare_http_request_failed');
  let body;
  try { body = await response.json(); }
  catch { throw new PagesCheckError('cloudflare_response_invalid_json'); }
  return verifyProject(body, project);
}

export function failureResult(error) {
  return {
    schema_version: 1,
    status: 'failed',
    error_code: error instanceof PagesCheckError ? error.message : 'unexpected_check_error',
    deployment_requested: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkPagesAccess(process.env))); }
  catch (error) {
    console.error(JSON.stringify(failureResult(error)));
    process.exitCode = 1;
  }
}
