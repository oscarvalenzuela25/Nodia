import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { repository } from './cd-github.mjs';
import { fetchMigrationBaseline } from './migration-baseline.mjs';

const sourceSha = 'a'.repeat(40);
const tree = 'b'.repeat(64);
const releaseId = `backend-${sourceSha.slice(0, 12)}-${tree.slice(0, 12)}`;
const workflowRun = { id: 123, run_attempt: 2, status: 'completed', conclusion: 'success', event: 'push',
  head_branch: 'master', head_sha: sourceSha, repository: { id: 99, full_name: repository },
  head_repository: { id: 99, full_name: repository }, path: '.github/workflows/ci.yml', name: 'Nodia CI' };
const artifact = (attempt, expired = false) => ({ id: 456 + attempt, name: `server-${sourceSha}-123-${attempt}`, expired,
  digest: `sha256:${'c'.repeat(64)}`, size_in_bytes: 20,
  workflow_run: { id: 123, head_sha: sourceSha, head_branch: 'master' } });

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-baseline-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const temp = path.join(directory, 'runner-temp');
  const root = path.join(directory, 'checkout');
  fs.mkdirSync(temp);
  fs.mkdirSync(root);
  const output = path.join(temp, 'baseline');
  return { temp, root, output, environment: { GITHUB_WORKSPACE: root, RUNNER_TEMP: temp, MIGRATION_BASELINE_SHA: sourceSha,
    MIGRATION_BASELINE_TREE: tree, MIGRATION_BASELINE_RELEASE: releaseId, MIGRATION_BASELINE_DIRECTORY: output } };
}

test('an older official attempt is selected only when its complete tree matches the deployed package', async t => {
  const { environment, output, root, temp } = fixture(t);
  const requests = [];
  const downloads = [];
  const files = ['artifact-result.json', 'build-metadata.json', `${releaseId}.manifest.json`, `${releaseId}.tar.gz`];
  const api = {
    async get(resource) {
      requests.push(resource);
      if (resource === 'actions/runs/123/attempts/1') return { ...workflowRun, run_attempt: 1 };
      assert.equal(resource, `actions/workflows/ci.yml/runs?branch=master&event=push&head_sha=${sourceSha}&per_page=8`);
      return { total_count: 1, workflow_runs: [workflowRun] };
    },
    async artifacts(ci) {
      assert.deepEqual(ci, { run_id: '123' });
      return [artifact(1), artifact(2)];
    },
    async download(item, filename) {
      downloads.push(item.id);
      fs.writeFileSync(filename, item.id);
    },
  };
  const result = await fetchMigrationBaseline(environment, {
    api,
    extract(filename, destination, component, sha) {
      assert.equal(component, 'server');
      assert.equal(sha, sourceSha);
      const downloadedId = fs.readFileSync(filename, 'utf8');
      fs.mkdirSync(destination);
      for (const name of files) fs.writeFileSync(path.join(destination, name), downloadedId);
    },
    verify(options) {
      const { output: unpacked, runAttempt, ...identity } = options;
      assert.equal(path.basename(unpacked), 'server');
      assert.deepEqual(identity, { root, component: 'server', sourceSha, runId: '123', repository,
        requireProduction: true, environment });
      return { release_id: releaseId, package_tree_sha256: runAttempt === '1' ? tree : tree.slice(0, 12) + 'd'.repeat(52) };
    },
  });
  assert.equal(result.run_attempt, '1');
  assert.equal(result.artifact_id, '457');
  assert.deepEqual(downloads, ['458', '457']);
  assert.deepEqual(requests.slice(1), ['actions/runs/123/attempts/1']);
  assert.deepEqual(fs.readdirSync(temp), ['baseline']);
  assert.deepEqual(fs.readdirSync(output).sort(), files.sort());
  for (const name of files) assert.equal(fs.readFileSync(path.join(output, name), 'utf8'), '457');
});

test('an expired package leaves no output and gives an explicit unavailable result', async t => {
  const { environment, temp } = fixture(t);
  const api = { get: async () => ({ total_count: 1, workflow_runs: [workflowRun] }),
    artifacts: async () => [artifact(2, true)], download: async () => assert.fail('expired artifact must not be downloaded') };
  await assert.rejects(fetchMigrationBaseline(environment, { api }), /migration_baseline_official_artifact_unavailable/);
  assert.deepEqual(fs.readdirSync(temp), []);
});
