import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyArtifact } from './artifact-release.mjs';
import {
  CdRejected, extractOriginalZip, githubClient, isHex, isSha, numeric, requireCd, safeFailure, selectArtifact, validateCiRun,
} from './cd-github.mjs';

const maxRuns = 8;
const maxAttempts = 16;
const maxDownloads = 8;

function isWithin(directory, target) {
  const relative = path.relative(directory, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function readInputs(environment) {
  const { MIGRATION_BASELINE_SHA: sourceSha, MIGRATION_BASELINE_RELEASE: releaseId, MIGRATION_BASELINE_TREE: tree,
    MIGRATION_BASELINE_DIRECTORY: directory, GITHUB_WORKSPACE: workspace, RUNNER_TEMP: runnerTemp } = environment;
  requireCd(isSha(sourceSha) && isHex(tree) && releaseId === `backend-${sourceSha.slice(0, 12)}-${tree.slice(0, 12)}`,
    'migration_baseline_identity_required');
  requireCd([directory, workspace, runnerTemp].every(value => typeof value === 'string' && path.isAbsolute(value)),
    'migration_baseline_runner_paths_required');
  const root = fs.realpathSync(workspace);
  const temp = fs.realpathSync(runnerTemp);
  const parent = fs.realpathSync(path.dirname(path.resolve(directory)));
  const output = path.join(parent, path.basename(path.resolve(directory)));
  requireCd(isWithin(temp, parent) && !isWithin(root, parent) && output !== temp &&
    !fs.lstatSync(output, { throwIfNoEntry: false }), 'migration_baseline_output_must_be_new_under_runner_temp');
  return { sourceSha, releaseId, tree, root, parent, output };
}

export async function fetchMigrationBaseline(environment = process.env,
  { api = githubClient(environment), extract = extractOriginalZip, verify = verifyArtifact } = {}) {
  const { sourceSha, releaseId, tree, root, parent, output } = readInputs(environment);
  const list = await api.get(`actions/workflows/ci.yml/runs?branch=master&event=push&head_sha=${sourceSha}&per_page=${maxRuns}`);
  requireCd(Number.isInteger(list?.total_count) && list.total_count >= 0 && Array.isArray(list.workflow_runs),
    'migration_baseline_ci_list_invalid');
  requireCd(list.total_count <= maxRuns && list.workflow_runs.length === list.total_count,
    'migration_baseline_ci_search_limit');

  let attemptsChecked = 0;
  let downloads = 0;
  let otherIdentity = false;
  for (const run of list.workflow_runs) {
    const runId = String(run?.id);
    const latestAttempt = String(run?.run_attempt);
    requireCd(numeric(runId) && numeric(latestAttempt) && run.head_sha === sourceSha, 'migration_baseline_ci_list_invalid');
    const artifacts = await api.artifacts({ run_id: runId });
    const artifactName = new RegExp(`^server-${sourceSha}-${runId}-([1-9][0-9]{0,5})$`);
    const attempts = new Set();
    for (const item of artifacts) {
      const match = typeof item?.name === 'string' && artifactName.exec(item.name);
      if (match && match[0] === item.name && item.expired !== true) attempts.add(match[1]);
    }
    for (const attempt of [...attempts].sort((first, second) => Number(second) - Number(first))) {
      requireCd(++attemptsChecked <= maxAttempts, 'migration_baseline_ci_attempt_search_limit');
      requireCd(Number(attempt) <= Number(latestAttempt), 'migration_baseline_ci_attempt_invalid');
      const attemptRun = attempt === latestAttempt ? run : await api.get(`actions/runs/${runId}/attempts/${attempt}`);
      if (attemptRun?.status !== 'completed' || attemptRun?.conclusion !== 'success') continue;
      const ci = validateCiRun(attemptRun, { runId, attempt, sourceSha });
      const artifact = selectArtifact(artifacts, 'server', ci);
      requireCd(++downloads <= maxDownloads, 'migration_baseline_archive_search_limit');
      const staging = fs.mkdtempSync(path.join(parent, 'nodia-baseline-'));
      try {
        const zip = path.join(staging, 'original.zip');
        const unpacked = path.join(staging, 'server');
        await api.download(artifact, zip);
        extract(zip, unpacked, 'server', sourceSha);
        let verified;
        try {
          verified = verify({ root, output: unpacked, component: 'server', sourceSha, runId, runAttempt: attempt,
            repository: ci.repository, requireProduction: true, environment });
        } catch {
          throw new CdRejected('migration_baseline_archive_verification_failed');
        }
        if (verified.release_id !== releaseId || verified.package_tree_sha256 !== tree) {
          otherIdentity = true;
          continue;
        }
        requireCd(!fs.lstatSync(output, { throwIfNoEntry: false }), 'migration_baseline_output_must_be_new_under_runner_temp');
        fs.renameSync(unpacked, output);
        return { status: 'verified', source_sha: sourceSha, release_id: releaseId, package_tree_sha256: tree,
          run_id: runId, run_attempt: attempt, artifact_id: artifact.id, artifact_zip_sha256: artifact.digest.slice(7) };
      } finally {
        fs.rmSync(staging, { recursive: true, force: true });
      }
    }
  }
  throw new CdRejected(otherIdentity ? 'migration_baseline_artifact_identity_mismatch' : 'migration_baseline_official_artifact_unavailable');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await fetchMigrationBaseline())); }
  catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
