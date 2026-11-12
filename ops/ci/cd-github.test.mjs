import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CdRejected, ZIP_LIMIT, extractOriginalZip, githubClient, outputs, repository,
  safeFailure, selectArtifact, validateCiRun } from './cd-github.mjs';

// All credentials, responses and archives below are synthetic; no network calls.
const sha = 'a'.repeat(40);
const ci = { run_id: '123', run_attempt: '2', source_sha: sha, repository };
const environment = { GITHUB_TOKEN: 'synthetic-github-token' };
const run = () => ({ id: 123, run_attempt: 2, status: 'completed', conclusion: 'success', event: 'push',
  head_branch: 'master', head_sha: sha, repository: { id: 99, full_name: repository },
  head_repository: { id: 99, full_name: repository }, path: '.github/workflows/ci.yml', name: 'Nodia CI' });
const artifact = () => ({ id: 456, name: `server-${sha}-123-2`, expired: false,
  digest: `sha256:${'b'.repeat(64)}`, size_in_bytes: 20,
  workflow_run: { id: 123, head_sha: sha, head_branch: 'master' } });
const options = { runId: ci.run_id, attempt: ci.run_attempt, sourceSha: sha };
const root = fileURLToPath(new URL('../../', import.meta.url));
const temporaryRoot = path.join(root, '.tmp/ci/cd-github-tests');
function fixture(t) {
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'case-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(temporaryRoot));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('only the exact successful master push CI run and latest attempt can authorize CD', () => {
  assert.deepEqual(validateCiRun(run(), options), ci);
  for (const change of [{ id: 124 }, { run_attempt: 1 }, { status: 'in_progress' }, { conclusion: 'failure' },
    { event: 'pull_request' }, { event: 'workflow_dispatch' }, { head_branch: 'development' },
    { head_sha: 'f'.repeat(40) }, { name: 'Other CI' }, { path: '.github/workflows/untrusted.yml' },
    { repository: { id: 99, full_name: 'fork/Nodia' } },
    { head_repository: { id: 100, full_name: repository } }]) {
    assert.throws(() => validateCiRun({ ...run(), ...change }, options), /trusted_master_ci_run_required/);
  }
});

test('current master is checked after CI identity and an invalid run never reaches the ref read', async () => {
  const calls = [];
  const client = githubClient(environment, async (url, request) => {
    calls.push(url);
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.Authorization, 'Bearer synthetic-github-token');
    return Response.json(url.endsWith('/123') ? run() : {
      ref: 'refs/heads/master', object: { type: 'commit', sha: 'f'.repeat(40) } });
  });
  await assert.rejects(client.gate('123', '2', sha), /ci_source_is_not_current_master/);
  assert.equal(calls.length, 2);
  let reads = 0;
  const rejected = githubClient(environment, async () => { reads++; return Response.json({ ...run(), event: 'pull_request' }); });
  await assert.rejects(rejected.gate('123', '2', sha), /trusted_master_ci_run_required/);
  assert.equal(reads, 1);
});

test('artifact metadata binds component, complete source, run, attempt, lifetime and official ZIP digest', () => {
  assert.equal(selectArtifact([artifact()], 'server', ci).id, '456');
  assert.equal(selectArtifact([], 'client', ci, { required: false }), null);
  assert.throws(() => selectArtifact([], 'client', ci), /required_component_artifact_missing/);
  assert.throws(() => selectArtifact([artifact(), artifact()], 'server', ci), /ambiguous_component_artifact/);
  for (const change of [{ expired: true }, { digest: null }, { digest: `sha256:${'b'.repeat(64)}\n` },
    { size_in_bytes: 0 }, { size_in_bytes: ZIP_LIMIT + 1 },
    { workflow_run: { id: 999, head_sha: sha, head_branch: 'master' } },
    { workflow_run: { id: 123, head_sha: 'f'.repeat(40), head_branch: 'master' } },
    { workflow_run: { id: 123, head_sha: sha, head_branch: 'development' } }]) {
    assert.throws(() => selectArtifact([{ ...artifact(), ...change }], 'server', ci), /official_artifact_source_invalid/);
  }
  assert.throws(() => selectArtifact([{ ...artifact(), name: `server-${sha}-123-1` }], 'server', ci), /required_component_artifact_missing/);
});

test('artifact pagination is bounded and does not accept an incomplete inventory', async () => {
  let requests = 0;
  const client = githubClient(environment, async () => {
    requests++;
    return Response.json({ total_count: 1, artifacts: [] });
  });
  await assert.rejects(client.artifacts(ci), /artifact_list_incomplete/);
  assert.equal(requests, 10);
});

test('the original ZIP is streamed once, hashed against the official digest and credentials stop at the API', async t => {
  const directory = fixture(t), filename = path.join(directory, '456.zip');
  const original = Buffer.from('synthetic original individual Actions ZIP');
  const digest = createHash('sha256').update(original).digest('hex');
  const calls = [];
  const client = githubClient(environment, async (url, request) => {
    calls.push({ url: String(url), request });
    if (calls.length === 1) return new Response(null, { status: 302,
      headers: { location: 'https://synthetic.blob.core.windows.net/artifact?signed=fixture' } });
    return new Response(original);
  });
  const result = await client.download({ id: '456', digest: 'sha256:' + digest }, filename);
  assert.deepEqual(result, { bytes: original.length, sha256: digest });
  assert.deepEqual(fs.readFileSync(filename), original);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].request.redirect, 'manual');
  assert.equal(calls[0].request.headers.Authorization, 'Bearer synthetic-github-token');
  assert.equal(calls[1].request.redirect, 'error');
  assert.equal(calls[1].request.headers, undefined);
});

test('a wrong ZIP digest removes its partial file and never retries the request', async t => {
  const filename = path.join(fixture(t), '456.zip');
  let requests = 0;
  const client = githubClient(environment, async () => {
    requests++;
    return requests === 1 ? new Response(null, { status: 302,
      headers: { location: 'https://synthetic.blob.core.windows.net/artifact' } }) : new Response('modified bytes');
  });
  await assert.rejects(client.download({ id: '456', digest: 'sha256:' + '0'.repeat(64) }, filename),
    /official_artifact_zip_digest_mismatch/);
  assert.equal(requests, 2);
  assert.equal(fs.existsSync(filename), false);
});

test('download redirects cannot forward credentials to foreign, HTTP, userinfo or custom-port endpoints', async t => {
  const directory = fixture(t);
  for (const location of ['http://synthetic.blob.core.windows.net/a', 'https://foreign.invalid/a',
    'https://blob.core.windows.net.foreign.invalid/a', 'https://user:pass@synthetic.blob.core.windows.net/a',
    'https://synthetic.blob.core.windows.net:8443/a']) {
    let requests = 0;
    const client = githubClient(environment, async () => { requests++; return new Response(null, { status: 302, headers: { location } }); });
    await assert.rejects(client.download({ id: '456', digest: 'sha256:' + 'b'.repeat(64) }, path.join(directory, '456.zip')),
      /artifact_download_location_invalid/);
    assert.equal(requests, 1);
  }
  assert.equal(fs.readdirSync(directory).length, 0);
});

test('HTTP and network failures never leak remote messages or retry reads/downloads', async t => {
  for (const status of [401, 403, 429, 500]) {
    let requests = 0;
    const client = githubClient(environment, async () => { requests++; return new Response('private remote body', { status }); });
    await assert.rejects(client.get('actions/runs/123'), /github_read_failed/);
    assert.equal(requests, 1);
  }
  const client = githubClient(environment, async () => { throw new Error('synthetic-github-token private network details'); });
  let caught;
  try { await client.download({ id: '456', digest: 'sha256:' + 'b'.repeat(64) }, path.join(fixture(t), '456.zip')); }
  catch (error) { caught = error; }
  assert.equal(JSON.stringify(safeFailure(caught)).includes('synthetic-github-token'), false);
  assert.deepEqual(safeFailure(new Error('private filesystem path')), {
    schema_version: 1, status: 'failed', error_code: 'cd_failed_inspect_private_state', automatic_retry_allowed: false });
  assert.equal(caught instanceof CdRejected, true);
});

const makeZip = String.raw`
import json,stat,sys,warnings,zipfile
warnings.simplefilter('ignore')
archive,entries=sys.argv[1],json.loads(sys.argv[2])
with zipfile.ZipFile(archive,'w') as output:
    for item in entries:
        info=zipfile.ZipInfo(item['name'])
        info.create_system=3
        info.external_attr=((stat.S_IFLNK if item.get('symlink') else stat.S_IFREG)|0o644)<<16
        info.compress_type=zipfile.ZIP_BZIP2 if item.get('bzip2') else zipfile.ZIP_DEFLATED
        output.writestr(info,'x'*item.get('size',2))
`;
function zipFixture(directory, entries) {
  const filename = path.join(directory, 'synthetic.zip');
  execFileSync('python3', ['-I', '-c', makeZip, filename, JSON.stringify(entries)], { stdio: 'pipe' });
  return filename;
}
function zipEntries(component = 'server') {
  const release = `${component === 'server' ? 'backend' : 'client'}-${sha.slice(0, 12)}-${'b'.repeat(12)}`;
  return ['artifact-result.json', 'build-metadata.json', release + '.tar.gz', release + '.manifest.json'].map(name => ({ name }));
}
const pythonUnavailable = process.platform === 'win32' ? 'strict extractor requires Linux python3; exercised in Linux CI/container' : false;

test('strict ZIP extraction accepts exactly four flat files for either component without executing payload', { skip: pythonUnavailable }, t => {
  const directory = fixture(t);
  for (const component of ['server', 'client']) {
    const output = path.join(directory, component);
    extractOriginalZip(zipFixture(directory, zipEntries(component)), output, component, sha);
    assert.equal(fs.readdirSync(output).length, 4);
    assert.equal(fs.readFileSync(path.join(output, 'artifact-result.json'), 'utf8'), 'xx');
  }
});

test('ZIP rejects extra/duplicate/traversal inventories, symlinks, unsupported compression and oversized metadata', { skip: pythonUnavailable }, t => {
  const directory = fixture(t);
  const cases = [
    [...zipEntries(), { name: 'extra.env' }],
    [...zipEntries().slice(0, 3), { name: 'artifact-result.json' }],
    [{ name: '../escaped.json' }, ...zipEntries().slice(1)],
    zipEntries().map((entry, index) => index ? entry : { ...entry, symlink: true }),
    zipEntries().map((entry, index) => index ? entry : { ...entry, bzip2: true }),
    zipEntries().map((entry, index) => index ? entry : { ...entry, size: 65537 }),
  ];
  for (const [index, entries] of cases.entries()) {
    assert.throws(() => extractOriginalZip(zipFixture(directory, entries), path.join(directory, 'out-' + index), 'server', sha),
      /official_zip_validation_failed/);
  }
  assert.equal(fs.existsSync(path.join(directory, 'escaped.json')), false);
});

test('existing extraction destinations and different source prefixes cannot be adopted', { skip: pythonUnavailable }, t => {
  const directory = fixture(t), existing = path.join(directory, 'existing');
  fs.mkdirSync(existing); fs.writeFileSync(path.join(existing, 'preserved'), 'unchanged');
  const zip = zipFixture(directory, zipEntries());
  assert.throws(() => extractOriginalZip(zip, existing, 'server', sha), /official_zip_validation_failed/);
  assert.equal(fs.readFileSync(path.join(existing, 'preserved'), 'utf8'), 'unchanged');
  assert.throws(() => extractOriginalZip(zip, path.join(directory, 'other'), 'server', 'f'.repeat(40)), /official_zip_validation_failed/);
});

test('validated action outputs reject multiline injection', t => {
  const filename = path.join(fixture(t), 'github-output');
  outputs({ source_sha: sha, run_id: '123' }, { GITHUB_OUTPUT: filename });
  assert.equal(fs.readFileSync(filename, 'utf8'), `source_sha=${sha}\nrun_id=123\n`);
  for (const value of ['123\nother=injected', '123\r', '123\0']) {
    assert.throws(() => outputs({ run_id: value }, { GITHUB_OUTPUT: filename }), /unsafe_action_output/);
  }
});

function workflowScript(filename) {
  const text = fs.readFileSync(path.join(root, '.github/workflows', filename), 'utf8');
  const match = /          script: \|\n([\s\S]*?)(?=\n {0,10}\S|$)/.exec(text);
  assert.ok(match, 'expected a single reviewed github-script action');
  const source = match[1].split('\n').map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction('github', 'context', 'core', 'process', source);
}
function actionFixture({ currentRun = run(), dispatchFailure = false } = {}) {
  const calls = [], failures = [], info = [], result = {};
  const github = { rest: {
    actions: {
      getWorkflowRun: async parameters => { calls.push(['get-run', parameters]); return { data: currentRun }; },
      createWorkflowDispatch: async parameters => {
        calls.push(['dispatch', parameters]);
        if (dispatchFailure) throw new Error('synthetic-github-token private response');
      },
      listWorkflowRuns: async parameters => { calls.push(['history', parameters]); return { data: { workflow_runs: [] } }; },
    },
    git: { getRef: async parameters => { calls.push(['get-ref', parameters]); return { data: { object: { type: 'commit', sha } } }; } },
  } };
  const core = { setFailed: value => failures.push(value), info: value => info.push(value),
    setOutput: (name, value) => { result[name] = value; } };
  return { github, core, calls, failures, info, result };
}

test('workflow_run dispatch sends only validated CI identity to master and has no production credentials', async () => {
  const fixture = actionFixture();
  const context = { eventName: 'workflow_run', repo: { owner: 'oscarvalenzuela25', repo: 'Nodia' }, payload: { workflow_run: run() } };
  await workflowScript('cd-dispatch.yml')(fixture.github, context, fixture.core, { env: {} });
  assert.deepEqual(fixture.failures, []);
  const dispatch = fixture.calls.filter(([kind]) => kind === 'dispatch');
  assert.equal(dispatch.length, 1);
  assert.deepEqual(dispatch[0][1], { owner: 'oscarvalenzuela25', repo: 'Nodia', workflow_id: 'cd.yml', ref: 'master',
    inputs: { ci_run_id: '123', ci_run_attempt: '2' }, request: { timeout: 20000 } });
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/cd-dispatch.yml'), 'utf8');
  assert.equal(workflow.includes('secrets.'), false);
  assert.equal(workflow.includes('environment: production'), false);
  assert.equal(workflow.includes('retries: 0'), true);
});

test('dispatcher never retries an uncertain POST or dispatches a PR/mismatched attempt', async () => {
  const context = { eventName: 'workflow_run', repo: { owner: 'oscarvalenzuela25', repo: 'Nodia' }, payload: { workflow_run: run() } };
  const unknown = actionFixture({ dispatchFailure: true });
  await workflowScript('cd-dispatch.yml')(unknown.github, context, unknown.core, { env: {} });
  assert.equal(unknown.calls.filter(([kind]) => kind === 'dispatch').length, 1);
  assert.deepEqual(unknown.failures, ['cd_dispatch_outcome_unknown_do_not_retry_automatically']);
  assert.equal(JSON.stringify(unknown.info).includes('synthetic-github-token'), false);
  for (const change of [{ event: 'pull_request' }, { run_attempt: 3 }, { head_branch: 'development' }]) {
    const rejected = actionFixture({ currentRun: { ...run(), ...change } });
    await workflowScript('cd-dispatch.yml')(rejected.github, context, rejected.core, { env: {} });
    assert.equal(rejected.calls.some(([kind]) => kind === 'dispatch'), false);
    assert.deepEqual(rejected.failures, ['trusted_master_ci_required_for_dispatch']);
  }
});

test('production workflow gates reruns/branches before checkout and carries prior-origin delivery history', async () => {
  const context = { eventName: 'workflow_dispatch', ref: 'refs/heads/master', runId: 999,
    repo: { owner: 'oscarvalenzuela25', repo: 'Nodia' }, payload: { inputs: { ci_run_id: '123', ci_run_attempt: '2' } } };
  const fixture = actionFixture({ currentRun: { ...run(), created_at: '2026-11-12T00:00:00Z' } });
  fixture.github.rest.actions.listWorkflowRuns = async parameters => {
    fixture.calls.push(['history', parameters]);
    return { data: { workflow_runs: [{ id: 998, display_title: 'Production from CI 123 attempt 2' }] } };
  };
  await workflowScript('cd.yml')(fixture.github, context, fixture.core, { env: { GITHUB_RUN_ATTEMPT: '1' } });
  assert.deepEqual(fixture.failures, []);
  assert.deepEqual(fixture.result, { source_sha: sha, prior_cd_run: 'true' });
  assert.equal(fixture.calls.find(([kind]) => kind === 'history')[1].created, '>=2026-11-12T00:00:00Z');
  for (const [changedContext, attempt] of [[{ ...context, ref: 'refs/heads/development' }, '1'], [context, '2']]) {
    const rejected = actionFixture();
    await workflowScript('cd.yml')(rejected.github, changedContext, rejected.core, { env: { GITHUB_RUN_ATTEMPT: attempt } });
    assert.equal(rejected.calls.length, 0);
    assert.equal(rejected.failures.length, 1);
  }
});
