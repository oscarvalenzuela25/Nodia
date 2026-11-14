import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { confirmPublishedClient, preflightClient, updateServer, updateClient, releaseSummary } from './cd-release.mjs';
import { CdRejected, safeFailure } from './cd-github.mjs';

function fixture(t) {
  const parent=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'nodia-release-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const root=path.join(parent,'source'),output=path.join(parent,'output');fs.mkdirSync(root);fs.mkdirSync(output);
  const environment={GITHUB_WORKSPACE:root,CD_WORKSPACE:output,GITHUB_EVENT_NAME:'workflow_dispatch',
    GITHUB_REF:'refs/heads/master',GITHUB_RUN_ATTEMPT:'1',CI_RUN_ID:'10',CI_RUN_ATTEMPT:'1',
    CI_SOURCE_SHA:'a'.repeat(40),CD_PRIOR_RUN:'false'};
  const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value));
  return {environment,write};
}
test('Pages cannot access credentials or make requests until backend completion matches the candidate',async t=>{
  const f=fixture(t);f.write('release-plan.json',{server_required:true,source_sha:f.environment.CI_SOURCE_SHA});
  for(const backend of [{status:'failed'},{status:'complete',source_sha:'b'.repeat(40)},{status:'submitted'}]){
    f.write('backend-result.json',backend);
    await assert.rejects(updateClient(f.environment),/backend_must_be_confirmed_before_pages/);
  }
});
test('rerun or development context cannot begin delivery even with existing state',async t=>{
  const f=fixture(t);
  for(const change of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REF:'refs/heads/development'},{GITHUB_EVENT_NAME:'pull_request'}])
    await assert.rejects(updateClient({...f.environment,...change}),/trusted_cd_dispatch_required/);
});
test('summary preserves separate partial results and explicitly excludes runtime/rollback claims',t=>{
  const f=fixture(t);f.write('backend-result.json',{status:'complete'});f.write('pages-state.json',{status:'pages_submission_requested'});
  f.write('failure.json',{error_code:'pages_write_outcome_unknown'});
  const result=releaseSummary(f.environment);assert.equal(result.backend,'complete');assert.equal(result.client,'pages_submission_requested');
});

test('post-publication success persists verification beside the existing deployment identity and clears an older error', async t => {
  const f = fixture(t), stateFile = path.join(f.environment.CD_WORKSPACE, 'pages-state.json');
  for (const status of ['complete', 'already_current']) {
    f.write('pages-state.json', { status: 'published_assets_verification_failed', error_code: 'old_failure' });
    const result = { status, source_sha: 'a'.repeat(40), deployment_id: 'synthetic-deployment',
      deployment_requested: status === 'complete' };
    let calls = 0;
    const confirmed = await confirmPublishedClient({ result, directory: 'synthetic-dist', stateFile,
      verify: async directory => { calls++; assert.equal(directory, 'synthetic-dist');
        return { pwa_assets_verified: true, pwa_assets_count: 10 }; } });
    assert.deepEqual(confirmed, { ...result, pwa_assets_verified: true, pwa_assets_count: 10, automatic_retry_allowed: false });
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)), confirmed);
    assert.equal(calls, 1); assert.equal(Object.hasOwn(result, 'pwa_assets_verified'), false);
  }
});

test('post-publication read failures preserve the published deployment, sanitize unknown errors and never retry', async t => {
  const f = fixture(t), stateFile = path.join(f.environment.CD_WORKSPACE, 'pages-state.json');
  const result = { status: 'complete', source_sha: 'a'.repeat(40), deployment_id: 'synthetic-deployment', deployment_requested: true };
  for (const [message, code] of [
    ['pwa_public_asset_digest_mismatch', 'pwa_public_asset_digest_mismatch'],
    ['pwa_private_remote_secret', 'pwa_public_assets_verification_failed'],
    ['private token https://remote.invalid/secret\ntrace', 'pwa_public_assets_verification_failed'],
  ]) {
    let calls = 0;
    await assert.rejects(confirmPublishedClient({ result, directory: 'synthetic-dist', stateFile,
      verify: async () => { calls++; throw new Error(message); } }), error => {
      assert.ok(error instanceof CdRejected); assert.equal(safeFailure(error).error_code, code); return true;
    });
    const state = JSON.parse(fs.readFileSync(stateFile));
    assert.deepEqual(state, { ...result, status: 'published_assets_verification_failed',
      pwa_assets_verified: false, error_code: code, automatic_retry_allowed: false });
    assert.doesNotMatch(JSON.stringify(state), /private|remote|secret|trace/);
    assert.equal(calls, 1); assert.equal(result.status, 'complete');
  }
});

function clientCandidate(t) {
  const f = fixture(t), calls = [], source = f.environment.CI_SOURCE_SHA;
  const artifact = { id: '123', digest: 'sha256:' + 'b'.repeat(64), directory: path.join(f.environment.CD_WORKSPACE, 'client'),
    metadata: { source_sha: source, package_tree_sha256: 'c'.repeat(64), public_configuration_sha256: 'd'.repeat(64) },
    result: { archive_file: 'synthetic.tar.gz' } };
  const plan = { source_sha: source, server_base: 'e'.repeat(40), server_required: true, client_required: true,
    prior_cd_run: true, ci: { run_id: '10', run_attempt: '1', repository: 'oscarvalenzuela25/Nodia' },
    client_baseline: { source_sha: 'e'.repeat(40), deployment_id: '11111111-1111-1111-1111-111111111111' },
    server_baseline: { release_id: 'backend-' + 'e'.repeat(12) + '-' + 'f'.repeat(12), package_tree_sha256: 'f'.repeat(64) },
    artifacts: { client: artifact, server: { ...artifact, result: { release_id: 'backend-' + source.slice(0, 12) + '-' + 'c'.repeat(12),
      package_tree_sha256: 'c'.repeat(64) } } } };
  f.write('release-plan.json', plan);
  const api = { gate: async () => { calls.push('gate'); } };
  const verify = options => { assert.equal(options.requireProduction, true); assert.equal(options.sourceSha, source); calls.push('verify'); };
  const extract = (program, args) => {
    calls.push('extract'); assert.equal(program, 'tar');
    const directory = path.join(args.at(-1), 'dist'); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'index.html'), '<title>Synthetic built artifact</title>');
  };
  const preflight = async options => {
    calls.push('preflight'); assert.equal(options.allowCreate, false); await options.revalidate();
    return { status: 'preflight_verified', source_sha: source, total_assets: 1, missing_assets: null,
      asset_check_performed: false, deployment_requested: false, asset_upload_requested: false,
      jwt: 'synthetic-upload-secret', response: { token: 'synthetic-remote-secret' } };
  };
  return { ...f, plan, calls, api, verify, extract, preflight };
}

test('a failed Pages preflight cannot reach backend effects or mint a successful local proof', async t => {
  const f = clientCandidate(t);
  await assert.rejects(preflightClient(f.environment, { api: f.api, verify: f.verify, extract: f.extract,
    preflight: async () => { throw new CdRejected('pages_response_unsuccessful'); } }), /pages_response_unsuccessful/);
  assert.equal(fs.existsSync(path.join(f.environment.CD_WORKSPACE, 'client-preflight.json')), false);
  let remoteCalls = 0;
  await assert.rejects(updateServer(f.environment, { api: { gate: async () => { remoteCalls++; } },
    read: async () => { remoteCalls++; }, deploy: async () => { remoteCalls++; } }), /client_preflight_required_before_backend/);
  assert.equal(remoteCalls, 0);
  assert.equal(f.calls.filter(value => value === 'extract').length, 1);
});

test('preflight binds the exact artifact and publication reuses its bytes without another extraction or leaking JWTs', async t => {
  const f = clientCandidate(t);
  const checked = await preflightClient(f.environment, f);
  assert.equal(checked.missing_assets, null); assert.equal(checked.asset_check_performed, false);
  assert.doesNotMatch(fs.readFileSync(path.join(f.environment.CD_WORKSPACE, 'client-preflight.json'), 'utf8'), /secret|jwt|response/);
  let backendCalls = 0;
  await updateServer(f.environment, { api: f.api, deploy: async options => {
    backendCalls++; assert.equal(options.allowNewSubmission, false);
    return { status: 'already_current', source_sha: f.plan.source_sha, deployment_requested: false };
  } });
  let published = 0;
  await updateClient(f.environment, { api: f.api, verify: f.verify,
    publish: async options => {
      published++; assert.equal(options.allowCreate, false);
      assert.deepEqual(options.expectedBaseline, f.plan.client_baseline);
      assert.match(fs.readFileSync(path.join(options.directory, 'index.html'), 'utf8'), /Synthetic built artifact/);
      await options.revalidate();
      return { status: 'already_current', source_sha: f.plan.source_sha, deployment_requested: false };
    }, confirm: async ({ result }) => result });
  assert.equal(backendCalls, 1); assert.equal(published, 1);
  assert.equal(f.calls.filter(value => value === 'extract').length, 1);
  assert.equal(f.calls.filter(value => value === 'verify').length, 2);
  assert.ok(f.calls.filter(value => value === 'gate').length >= 4);
});

test('replacing the preflight identity or changing extracted bytes blocks backend and publication', async t => {
  const f = clientCandidate(t), checked = await preflightClient(f.environment, f);
  let contacted = false;
  for (const change of [{ source_sha: 'f'.repeat(40) }, { artifact_digest: 'sha256:' + 'f'.repeat(64) },
    { ci_run_attempt: '2' }, { deployment_requested: true }, { asset_upload_requested: true }]) {
    f.write('client-preflight.json', { ...checked, ...change });
    await assert.rejects(updateServer(f.environment, { api: f.api, deploy: async () => { contacted = true; } }),
      /client_preflight_identity_mismatch/);
  }
  f.write('client-preflight.json', checked);
  fs.writeFileSync(path.join(f.environment.CD_WORKSPACE, 'client-static', 'dist', 'index.html'), 'changed after preflight');
  f.write('backend-result.json', { status: 'complete', source_sha: f.plan.source_sha });
  await assert.rejects(updateClient(f.environment, { api: f.api, verify: f.verify,
    publish: async () => { contacted = true; } }), /client_static_changed_after_preflight/);
  assert.equal(contacted, false);
});
