import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deployBackend, operationId, requireReady } from './cd-vps.mjs';
const blob = Buffer.concat([Buffer.from([0,0,0,11]), Buffer.from('ssh-ed25519'), Buffer.from([0,0,0,32]), Buffer.alloc(32,7)]);
const expectedFingerprint = 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
const environment = { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/master', GITHUB_RUN_ATTEMPT: '1',
  VPS_HOST: '166.0.112.187', VPS_PORT: '22', VPS_USER: 'nodia-deploy', VPS_KNOWN_HOSTS: `166.0.112.187 ssh-ed25519 ${blob.toString('base64')}\n`,
  VPS_SSH_PRIVATE_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----\nsynthetic-only\n-----END OPENSSH PRIVATE KEY-----\n' };
const old = 'a'.repeat(40), next = 'b'.repeat(40), tree = 'c'.repeat(64), oldTree = 'd'.repeat(64);
const release = (source, hash) => `backend-${source.slice(0,12)}-${hash.slice(0,12)}`;
const ready = (source = old, hash = oldTree) => ({ schema_version:1,status:'deployment_ready',user:'nodia-deploy',forced_command:true,
  deployment_implemented:true,privileged_helper_enabled:true,deployment_requested:false,blocked:false,application:{api_active:true,worker_active:true},
  current:{source_sha:source,package_tree_sha256:hash,release_id:release(source,hash)} });
const ci = { run_id:'10',run_attempt:'1',source_sha:next }, artifact = {id:'20',digest:'sha256:'+'e'.repeat(64)}, id=operationId(artifact,ci);
const operation = phase => ({schema_version:1,status:'operation_status',operation_id:id,phase,effects_started:true,migration_requested:true,deployment_performed:phase==='complete'});
const options = {environment,plan:{server_required:true,source_sha:next,server_base:old},artifact,ci,zipFile:'unused-fixture.zip',zipBytes:123,
  expectedRelease:release(old,oldTree),expectedTree:oldTree,candidateRelease:release(next,tree),candidateTree:tree,
  sshOptions:{expectedFingerprint},sleep:async()=>{},pollLimit:2};
test('backend transport submits once, verifies artifact receipt and confirms both healthy writers', async () => {
  const calls=[];
  const replies=[{code:1,body:{status:'failed',error_code:'operation_not_found'}},{code:0,body:ready()},
    {code:0,body:{schema_version:1,status:'uploaded',artifact_id:'20',artifact_zip_sha256:'e'.repeat(64),bytes:123,deployment_requested:false}},
    {code:0,body:{schema_version:1,status:'submitted',operation_id:id,phase:'submitted',deployment_requested:true,automatic_retry_allowed:false}},
    {code:0,body:operation('complete')},{code:0,body:ready(next,tree)}];
  const result=await deployBackend({...options,send:async(_,command,args)=>{calls.push([command,args]);return replies.shift();}});
  assert.equal(result.status,'complete');assert.equal(calls.filter(([x])=>x.startsWith('upload ')).length,1);
  assert.equal(calls.filter(([x])=>x.startsWith('deploy ')).length,1);assert.equal(calls[2][1].timeout,180000);
});
test('an existing operation is queried before global readiness and never resubmitted',async()=>{
  const calls=[];const replies=[operation('preparing'),operation('complete'),ready(next,tree)];
  assert.equal((await deployBackend({...options,allowNewSubmission:false,send:async(_,command)=>{calls.push(command);return {code:0,body:replies.shift()};}})).status,'complete');
  assert.deepEqual(calls,[`status ${id}`,`status ${id}`,'status']);
});
test('uncertain submission and previous CD origin cannot repeat effects',async()=>{
  let calls=0;
  await assert.rejects(deployBackend({...options,allowNewSubmission:false,send:async()=>++calls===1?{code:1,body:{status:'failed',error_code:'operation_not_found'}}:{code:0,body:ready()}}),/prior_cd_run/);
  assert.equal(calls,2);
  await assert.rejects(deployBackend({...options,send:async()=>({code:0,body:operation('unknown')})}),/requires_reconciliation/);
  assert.throws(()=>requireReady({...ready(),blocked:true}));assert.throws(()=>requireReady({...ready(),application:{api_active:true,worker_active:false}}));
});
