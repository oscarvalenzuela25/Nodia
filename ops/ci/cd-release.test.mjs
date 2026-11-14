import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { confirmPublishedClient, updateClient, releaseSummary } from './cd-release.mjs';
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
