'use strict';

// Offline inspection only. No application imports, auth/session reads or network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(__dirname, '../../..');
const candidate = path.resolve(root, '.tmp/ai38-client-candidate01/nodia-client');
const manifestBytes = fs.readFileSync(path.join(candidate, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const entries = Object.entries(manifest.files).filter(([name]) => name.startsWith('dist/'));
if (entries.length !== 171) throw new Error('Unexpected frozen Client output count');
for (const [name, expected] of entries) {
  const filename = path.resolve(candidate, name);
  if (!filename.startsWith(candidate + path.sep)) throw new Error('Candidate path escaped');
  if (sha(fs.readFileSync(filename)) !== expected) throw new Error('Frozen output mismatch: ' + name);
}
const apiEntries = entries.filter(([name]) => /^dist\/assets\/api-[^/]+\.js$/.test(name));
if (apiEntries.length !== 1) throw new Error('Expected exactly one transport chunk');
const [apiPath, apiSha] = apiEntries[0];
const apiText = fs.readFileSync(path.join(candidate, apiPath), 'utf8');
const embeddedApi = /API_URL:`([^`]+)`/.exec(apiText)?.[1];
const embeddedClient = /GOOGLE_CLIENT_ID:`([^`]+)`/.exec(apiText)?.[1];
if (embeddedApi !== '/api/v1' || !embeddedClient?.endsWith('.apps.googleusercontent.com')) {
  throw new Error('Unexpected frozen public configuration; inspect explicitly');
}
const html = fs.readFileSync(path.join(candidate, 'dist/index.html'), 'utf8');
if (!html.includes('src="/assets/') || html.includes('runtime-config')) throw new Error('Unexpected asset/config contract');

process.stdout.write(JSON.stringify({
  stage: 'AI-38',
  scope: 'offline_frozen_Client_origin_authentication_adoption_preflight_only',
  status: 'passed_offline_not_deployed_or_browser_accepted',
  manifest_sha256: sha(manifestBytes),
  verified_outputs: entries.length,
  transport_chunk: { path: apiPath, sha256: apiSha },
  public_config: { api_url: embeddedApi, google_client_id_present: true, google_client_id_sha256: sha(embeddedClient) },
  deployment_contract: {
    rebuild_required_for_same_embedded_configuration: false,
    runtime_environment_override_supported: false,
    asset_mount: '/',
    SPA_fallback_required: true,
    same_origin_API_proxy_prefix: '/api/v1',
    preserve_Origin_Authorization_and_Set_Cookie: true,
    google_popup_COOP_header: 'same-origin-allow-popups',
    production_server_requires_HTTPS_allowed_origin_and_Secure_refresh_cookie: true,
    Google_console_authorized_origin_verified: false,
  },
  authentication_contract: {
    flow: 'Google GIS popup JS credential callback -> POST /api/v1/auth/login',
    OAuth_redirect_callback_route: null,
    existing_session_restoration: 'GET /api/v1/auth/me; ordinary refresh POST /api/v1/auth/refresh when required',
    persistent_client_hint: 'origin-scoped authStore; validated by server before private route',
    refresh_cookie_path: '/api/v1/auth',
    refresh_cookie_HttpOnly: true,
    target_module: '/tools/nodia-ai',
    authorization_context: 'GET /api/v1/authorization/context',
    token_transfer_or_fixture_injection_permitted: false,
    session_restoration_does_not_prove_new_Google_login: true,
  },
  read_only_browser_checklist: [
    'Confirm served index and fetched chunks match frozen manifest; no dev client or fixture shell.',
    'Use existing legitimate session on same origin; reload and observe successful auth/me plus authorization/context without recording credentials.',
    'If no valid session exists, human completes actual Google UI; verify login succeeds without printing request credential/response token.',
    'Navigate Home -> NodiaAI through full shell and direct route reload; preserve legitimate owner and module authorization.',
    'List own chats only; open explicitly designated acceptance chat, verify title/history/current execution without issuing messages.',
    'Open configuration drawer, verify connection/mode/model/effort match configured exact selection; GET eligibility only; close Cancel.',
    'Observe Web MCP false versus Agentic true without applying mode or enabling routing; configuration is never availability proof.',
    'Navigate away and back, then reload designated chat; verify persisted server data and no new run/operation.',
    'Check full shell and drawer at mobile390 and desktop1440: no document overflow, focus return, usable close and scroll.',
    'Record status/path/field-presence and asset hashes only; omit credentials, personal chat text, email, cookies and bearer headers.',
  ],
  browser_acceptance_not_implied: ['new_Google_login', 'provider_inference', 'MCP_callback', 'business_write', 'revocation', 'UI_R2_or_physical_microphone', 'rollback', 'public_TLS_or_external_exposure'],
  effects: { network_requests: 0, provider_requests: 0, database_access: false, data_writes: 0, service_changes: 0 },
}, null, 2) + '\n');
