// Real Chromium -> production React components -> real HTTP -> disposable SQL.
// Authentication, Redis and initial preparation are explicit fixtures, not MCP.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const client = fileURLToPath(new URL('../../../nodia-client/', import.meta.url));
const requireClient = createRequire(new URL('../../../nodia-client/package.json', import.meta.url));
const { chromium } = requireClient('playwright');
const { createServer } = await import(pathToFileURL(requireClient.resolve('vite')).href);
const origin = 'http://127.0.0.1:5177', backend = 'http://127.0.0.1:47838';
const run = process.argv[2];
if (!/^r\d{2}$/.test(run ?? '')) throw Error('Use a fresh rNN acceptance identifier');
const output = fileURLToPath(new URL(`../nodia-ai-ai38-acceptance-${run}.json`, import.meta.url));
if (existsSync(output)) throw Error('Refusing to overwrite acceptance evidence');
const hashFile = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const files = [
  'nodia-server/test/nodia-ai-ai38-acceptance.integration.mjs',
  'nodia-server/test/nodia-ai.integration.fixture.mjs',
  'nodia-client/src/test/manual/nodia-ai-ai38/main.tsx',
  'nodia-client/src/test/manual/nodia-ai-ai38/index.html',
  'docs/evidence/scripts/nodia-ai-ai38-acceptance-ui.mjs',
];
const sourceHashes = files.map(path => ({ path, sha256: hashFile(fileURLToPath(new URL('../../../' + path, import.meta.url))) }));
let server, browser, manifest, finalSnapshot, apiReport;
const checks = [], profiles = [], requests = [], pageErrors = [], blockedExternal = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
const fetchJson = async (path, { method = 'GET', body, actor = '1', expected = 200 } = {}) => {
  const response = await fetch(backend + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${path} unexpected status ${response.status} ${JSON.stringify(value)}`);
  return value;
};
const snapshot = () => fetchJson('/__ai38/snapshot');
const control = action => fetchJson('/__ai38/control/' + action, { method: 'POST', body: {} });
let failure;
try {
  manifest = await fetchJson('/__ai38/manifest');
  assert.match(manifest.context.package_manifest_sha256, /^[a-f0-9]{64}$/);
  server = await createServer({ root: client, configFile: client + 'vite.config.ts', mode: 'ai38-acceptance', server: { port: 5177, host: '127.0.0.1', strictPort: true, proxy: { '^/api/v1(?:/|$)': { target: backend, changeOrigin: false }, '/__ai38': { target: backend, changeOrigin: false } } } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blockedExternal.push({ method: route.request().method(), origin: new URL(route.request().url()).origin });
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/v1/')) requests.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
  });
  const open = async (view, extra = '') => {
    await page.goto(`${origin}/src/test/manual/nodia-ai-ai38/index.html?view=${view}${extra}`);
    await page.evaluate(() => document.fonts.ready);
  };
  await open('review');
  await page.getByRole('button', { name: 'Confirmar revisión 1', exact: true }).waitFor();
  check('owner preview is rendered by the production component through real HTTP without effects', (await snapshot()).finance_count === 0 && requests.some(row => row.path.includes('/proposals/') && row.status === 200));
  check('opening preview issues no business mutation or confirmation', requests.every(row => row.method === 'GET'));
  await fetchJson(`/api/v1/nodia-ai/proposals/${manifest.proposal.proposal_id}/confirmation-challenge`, { method: 'POST', expected: 409, body: { proposal_revision: 1, expected_hash: 'f'.repeat(64) } });
  check('server rejects a mismatched preview hash without a financial effect', (await snapshot()).finance_count === 0);
  await fetchJson(`/api/v1/nodia-ai/proposals/${manifest.proposal.proposal_id}`, { actor: '2', expected: [403, 404] });
  await open('review', '&actor=2');
  await page.getByRole('alert').filter({ hasText: 'Esta propuesta ya no está disponible' }).waitFor();
  check('unrelated user receives real denial and the UI removes command content', await page.getByText('Synthetic AI38 visible expense', { exact: true }).count() === 0 && await page.getByRole('button', { name: /Confirmar revisión/ }).count() === 0);
  await open('review', '&actor=3');
  await page.getByText('Esta revisión se conserva como referencia', { exact: false }).waitFor();
  check('super_admin can inspect another owner preview but cannot confirm that owner intention', await page.getByText('Synthetic AI38 visible expense', { exact: true }).count() > 0 && await page.getByRole('button', { name: /Confirmar revisión/ }).count() === 0);
  await open('review');
  await page.getByRole('button', { name: 'Corregir propuesta', exact: true }).click();
  await page.getByRole('textbox', { name: /^Monto\s*\*?$/ }).fill('21000');
  await page.getByRole('button', { name: 'Guardar nueva revisión', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirmar revisión 2', exact: true });
  await confirm.waitFor();
  const revised = await fetchJson('/__ai38/manifest');
  check('editing the production review creates a distinct exact revision over HTTP without a domain effect', revised.proposal.revision === 2 && revised.proposal.hash !== manifest.proposal.hash && (await snapshot()).finance_count === 0);
  manifest = revised;
  await confirm.click();
  await page.getByRole('status').filter({ hasText: 'Estado de la operación: En cola' }).waitFor();
  let current = await snapshot();
  check('human button admits one queued execution bound to the edited revision and no inline effect', current.executions.length === 1 && current.executions[0].state === 'queued' && current.finance_count === 0);
  const queued = current.executions[0].id;
  const postsBeforeLeave = requests.filter(row => row.method === 'POST').length;
  await page.goto('about:blank');
  await control('execute');
  current = await snapshot();
  check('native worker commits the queued effect and atomic receipt while UI observation is absent', current.finance_count === 1 && current.movements[0].amount === '21000' && current.executions.find(row => row.id === queued)?.state === 'completed' && current.receipts[0].minimal_receipt.resource_key === 'finance_movements');
  const receiptHash = createHash('sha256').update(JSON.stringify(current.receipts)).digest('hex');
  await open('review');
  await page.getByRole('status').filter({ hasText: 'Estado de la operación: Completada' }).waitFor();
  check('returning to review restores the receipt without repeating confirmation', requests.filter(row => row.method === 'POST').length === postsBeforeLeave && (await snapshot()).finance_count === 1);
  await open('finance');
  await page.getByText('Synthetic AI38 visible expense', { exact: true }).waitFor();
  check('the expense is visible in the actual Finance page from its native HTTP list', requests.some(row => row.path === '/api/v1/finance/movements' && row.status === 200) && await page.getByText('Synthetic AI38 visible expense', { exact: true }).count() > 0);
  await page.screenshot({ path: output.replace('.json', '-finance.png'), fullPage: true });
  await open('chat');
  await page.getByText('Synthetic AI38 earlier owner message', { exact: true }).waitFor();
  check('returning to the actual chat recovers the persisted owner message without generation', (await snapshot()).provider_calls === 0 && requests.filter(row => row.method === 'POST').length === postsBeforeLeave);
  await control('new-cancellable-preview');
  await open('review');
  await page.getByRole('button', { name: 'Confirmar revisión 1', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar ejecución', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Estado de la operación: Cancelada' }).waitFor();
  current = await snapshot();
  check('cancelling through the production button cancels the queued intent without a second effect', current.finance_count === 1 && current.executions.some(row => row.state === 'cancelled') && current.pending_jobs === 0);
  await fetchJson('/__ai38/control/execute', { method: 'POST', body: {}, expected: 409 });
  check('a cancelled execution cannot be claimed by the native worker', (await snapshot()).finance_count === 1);
  await control('revoke-finance');
  await open('review');
  await page.getByRole('alert').filter({ hasText: 'Esta propuesta ya no está disponible' }).waitFor();
  check('current destination-module revocation hides persisted proposal data over actual HTTP', await page.getByText('Synthetic AI38 cancelled expense', { exact: true }).count() === 0 && await page.getByRole('button', { name: /Confirmar revisión/ }).count() === 0);
  await open('chat');
  await page.getByText('Este mensaje contiene información que tus permisos actuales no permiten consultar.', { exact: true }).waitFor();
  check('revocation also redacts the persisted message in the actual chat', await page.getByText('Synthetic AI38 earlier owner message', { exact: true }).count() === 0);
  await control('restore-finance');
  await open('chat');
  await page.getByText('Synthetic AI38 earlier owner message', { exact: true }).waitFor();
  check('restored access reveals the same persisted message without replaying either execution', (await snapshot()).finance_count === 1 && (await snapshot()).pending_jobs === 0);
  for (const profile of [{ width: 390, lang: 'es', theme: 'dark' }, { width: 600, lang: 'en', theme: 'light' }, { width: 1440, lang: 'es', theme: 'light' }]) {
    await page.setViewportSize({ width: profile.width, height: 1000 });
    await open('finance', `&lang=${profile.lang}&theme=${profile.theme}`);
    await page.getByText('Synthetic AI38 visible expense', { exact: true }).waitFor();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(dimensions.scroll <= dimensions.client, `Horizontal overflow ${JSON.stringify(profile)}`);
    profiles.push({ ...profile, expense_visible: true, document_overflow: false });
  }
  check('native Finance content remains visible across mobile/tablet/desktop and both languages/themes', profiles.length === 3);
  finalSnapshot = await snapshot();
  const completedReceipts = finalSnapshot.receipts.filter(row => row.state === 'completed');
  check('the original atomic receipt survives cancellation revocation and navigation unchanged', completedReceipts.length === 1 && receiptHash === createHash('sha256').update(JSON.stringify(completedReceipts)).digest('hex'));
  apiReport = await fetchJson('/__ai38/report');
  check('neither provider storage nor the configured database is used by the isolated chain', finalSnapshot.provider_calls === 0 && finalSnapshot.storage_calls === 0 && apiReport.configured_database_used === false);
  check('all UI requests stay on the fixture origin without JavaScript errors', pageErrors.length === 0 && blockedExternal.length === 0);
} catch (error) {
  failure = { name: error.name, message: error.message };
  const failedPage = browser?.contexts()[0]?.pages()[0];
  if (failedPage) {
    await failedPage.screenshot({ path: output.replace('.json', '-failure.png'), fullPage: true }).catch(() => {});
    failure.visible_text = (await failedPage.locator('body').innerText().catch(() => '')).slice(0, 12000);
  }
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}
const report = {
  stage: 'AI-38', status: failure ? 'failed' : 'passed', scope: 'isolated_production_ui_http_sql', context: manifest?.context ?? null,
  checked_at: new Date().toISOString(), checks: checks.length, results: checks, profiles, requests, page_errors: pageErrors, external_requests_blocked: blockedExternal,
  source_hashes: sourceHashes, final_snapshot: finalSnapshot ?? null, api_report: apiReport ?? null, failure: failure ?? null,
  boundaries: { synthetic_authenticated_transport: true, synthetic_redis: true, preparation_via_internal_native_port: true, natural_language_or_mcp_preparation_verified: false, real_provider_inferences: 0, configured_database_writes: 0, storage_operations: 0, live_environment_acceptance: false, product_context_evolution_verified: false, api_paid_mode_verified: false, cleanup_verified_separately: true },
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, checks: report.checks, output, failure: report.failure }));
if (failure) process.exitCode = 1;
