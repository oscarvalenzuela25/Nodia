import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { updateClient, releaseSummary } from './cd-release.mjs';

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
