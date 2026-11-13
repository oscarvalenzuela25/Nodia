import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyArtifact } from './artifact-release.mjs';
import { extractOriginalZip, githubClient, isSha, numeric, outputs, requireCd, safeFailure, selectArtifact, writeState } from './cd-github.mjs';
import { deploymentPlan, unmanagedRuntimePaths } from './cd-selection.mjs';
import { deployBackend, readBackend } from './cd-vps.mjs';
import { publishPages } from './cd-pages.mjs';

function workspace(environment) {
  const output = path.resolve(environment.CD_WORKSPACE ?? '');
  const root = fs.realpathSync(environment.GITHUB_WORKSPACE);
  requireCd(environment.CD_WORKSPACE && path.isAbsolute(environment.CD_WORKSPACE) && output !== root &&
    !output.startsWith(root + path.sep), 'cd_workspace_outside_checkout_required');
  if (!fs.existsSync(output)) fs.mkdirSync(output, { mode: 0o700 });
  requireCd(fs.lstatSync(output).isDirectory() && !fs.lstatSync(output).isSymbolicLink(), 'cd_workspace_invalid');
  return { output, root };
}
function context(environment) {
  requireCd(environment.GITHUB_EVENT_NAME === 'workflow_dispatch' && environment.GITHUB_REF === 'refs/heads/master' &&
    environment.GITHUB_RUN_ATTEMPT === '1' && numeric(environment.CI_RUN_ID) && numeric(environment.CI_RUN_ATTEMPT) &&
    isSha(environment.CI_SOURCE_SHA) && ['true', 'false'].includes(environment.CD_PRIOR_RUN), 'trusted_cd_dispatch_required');
}
export async function prepareRelease(environment = process.env, { api = githubClient(environment) } = {}) {
  context(environment);
  const { root, output } = workspace(environment);
  const ci = await api.gate(environment.CI_RUN_ID, environment.CI_RUN_ATTEMPT, environment.CI_SOURCE_SHA);
  const client = JSON.parse(fs.readFileSync(path.join(output, 'client-baseline.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(output, 'server-baseline.json'), 'utf8'));
  requireCd(client.status === 'baseline_verified' && server.status === 'baseline_verified' &&
    isSha(client.source_sha) && isSha(server.source_sha) && typeof client.config_changed === 'boolean' &&
    server.current?.source_sha === server.source_sha, 'release_baselines_invalid');
  const unmanaged = unmanagedRuntimePaths({ repo: root, base: server.source_sha, head: ci.source_sha });
  if (unmanaged.length) {
    writeState(path.join(output, 'runtime-block.json'), { error_code: 'unmanaged_runtime_change_requires_coordinated_rollout',
      paths: unmanaged.slice(0, 100), total_paths: unmanaged.length });
    requireCd(false, 'unmanaged_runtime_change_requires_coordinated_rollout');
  }
  const plan = deploymentPlan({ repo: root, head: ci.source_sha, clientBase: client.source_sha,
    serverBase: server.source_sha, forceClient: client.config_changed });
  const listed = await api.artifacts(ci);
  const result = { ...plan, ci, prior_cd_run: environment.CD_PRIOR_RUN === 'true',
    client_baseline: client, server_baseline: server.current, artifacts: {} };
  for (const component of ['server', 'client']) {
    if (!plan[component + '_required']) continue;
    const artifact = selectArtifact(listed, component, ci);
    const zipFile = path.join(output, component + '.zip');
    const downloaded = await api.download(artifact, zipFile);
    const directory = path.join(output, component);
    extractOriginalZip(zipFile, directory, component, ci.source_sha);
    // Client config was separately read in the production environment; values are public only.
    verifyArtifact({ root, output: directory, component, sourceSha: ci.source_sha, runId: ci.run_id,
      runAttempt: ci.run_attempt, repository: ci.repository, requireProduction: true, environment });
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'build-metadata.json'), 'utf8'));
    requireCd(metadata.production_eligible === true, 'production_artifact_required');
    result.artifacts[component] = { ...artifact, zip_file: zipFile, zip_bytes: downloaded.bytes,
      directory, metadata, result: JSON.parse(fs.readFileSync(path.join(directory, 'artifact-result.json'), 'utf8')) };
  }
  writeState(path.join(output, 'release-plan.json'), result);
  outputs({ server_required: String(plan.server_required), client_required: String(plan.client_required) }, environment);
  return { status: 'prepared', source_sha: ci.source_sha, server_required: plan.server_required,
    client_required: plan.client_required, python_or_native_deployed: false };
}
export async function updateServer(environment = process.env) {
  context(environment);
  const { output } = workspace(environment);
  const plan = JSON.parse(fs.readFileSync(path.join(output, 'release-plan.json'), 'utf8'));
  const api = githubClient(environment);
  await api.gate(plan.ci.run_id, plan.ci.run_attempt, plan.source_sha);
  let result;
  if (!plan.server_required) {
    const baseline = await readBackend(environment);
    requireCd(baseline.source_sha === plan.server_base, 'backend_changed_after_plan');
    result = { status: 'not_required', source_sha: baseline.source_sha, deployment_requested: false };
  } else {
    const artifact = plan.artifacts.server;
    result = await deployBackend({ environment, plan, artifact, zipFile: artifact.zip_file, zipBytes: artifact.zip_bytes, ci: plan.ci,
      expectedRelease: plan.server_baseline.release_id, expectedTree: plan.server_baseline.package_tree_sha256,
      candidateRelease: artifact.result.release_id, candidateTree: artifact.result.package_tree_sha256,
      allowNewSubmission: !plan.prior_cd_run, stateFile: path.join(output, 'backend-state.json') });
  }
  writeState(path.join(output, 'backend-result.json'), result);
  return result;
}
export async function updateClient(environment = process.env) {
  context(environment);
  const { root, output } = workspace(environment);
  const plan = JSON.parse(fs.readFileSync(path.join(output, 'release-plan.json'), 'utf8'));
  const backend = JSON.parse(fs.readFileSync(path.join(output, 'backend-result.json'), 'utf8'));
  requireCd(plan.server_required ? ['complete', 'already_current'].includes(backend.status) && backend.source_sha === plan.source_sha :
    backend.status === 'not_required', 'backend_must_be_confirmed_before_pages');
  const api = githubClient(environment);
  const revalidate = () => api.gate(plan.ci.run_id, plan.ci.run_attempt, plan.source_sha);
  await revalidate();
  let result;
  if (!plan.client_required) result = { status: 'not_required', deployment_requested: false };
  else {
    const artifact = plan.artifacts.client;
    verifyArtifact({ root, output: artifact.directory, component: 'client', sourceSha: plan.source_sha,
      runId: plan.ci.run_id, runAttempt: plan.ci.run_attempt, repository: plan.ci.repository,
      requireProduction: true, environment });
    const extracted = path.join(output, 'client-static');
    requireCd(!fs.existsSync(extracted), 'static_extract_already_exists');
    fs.mkdirSync(extracted, { mode: 0o700 });
    try { execFileSync('tar', ['-xzf', path.join(artifact.directory, artifact.result.archive_file), '-C', extracted], { stdio: 'ignore' }); }
    catch { requireCd(false, 'verified_client_extract_failed'); }
    result = await publishPages({ environment, metadata: artifact.metadata, directory: path.join(extracted, 'dist'),
      expectedBaseline: plan.client_baseline, allowCreate: !plan.prior_cd_run,
      stateFile: path.join(output, 'pages-state.json'), revalidate });
  }
  writeState(path.join(output, 'client-result.json'), result);
  return result;
}
export function releaseSummary(environment = process.env) {
  const { output } = workspace(environment);
  const read = name => fs.existsSync(path.join(output, name)) ? JSON.parse(fs.readFileSync(path.join(output, name), 'utf8')) : null;
  const plan = read('release-plan.json'), backend = read('backend-result.json') ?? read('backend-state.json'),
    client = read('client-result.json') ?? read('pages-state.json'), failure = read('failure.json');
  const text = '### Production delivery\n\n' +
    `Source: \`${plan?.source_sha ?? 'not prepared'}\`.\n\n` +
    '| Component | Last confirmed state |\n| --- | --- |\n' +
    `| API/worker | ${backend?.status ?? 'not confirmed'} |\n| Static Client | ${client?.status ?? 'not confirmed'} |\n\n` +
    (failure ? `Stopped with \`${failure.error_code}\`; no automatic retry.\n\n` : '') +
    'Python/native runtimes are not deployed or enabled by this delivery. AI capability qualification remains separate.\n' +
    'Pages/VPS publication is not atomic; a partial result records each component separately. No database restore/rollback is automatic.\n';
  if (environment.GITHUB_STEP_SUMMARY) fs.appendFileSync(environment.GITHUB_STEP_SUMMARY, text);
  return { status: 'summarized', backend: backend?.status ?? 'not_confirmed', client: client?.status ?? 'not_confirmed' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    const operation = { prepare: prepareRelease, backend: updateServer, client: updateClient, summary: releaseSummary }[command];
    requireCd(operation, 'release_command_invalid');
    console.log(JSON.stringify(await operation()));
  } catch (error) {
    const value = safeFailure(error);
    if (process.env.CD_WORKSPACE && fs.existsSync(process.env.CD_WORKSPACE)) writeState(path.join(process.env.CD_WORKSPACE, 'failure.json'), value);
    console.error(JSON.stringify(value)); process.exitCode = 1;
  }
}
