import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deployBackend, operationId, requireReady } from './cd-vps.mjs';
import { CdRejected } from './cd-github.mjs';
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

function uploadFixture(t, reply) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-cd-upload-'));
  t.after(() => {
    fs.unlinkSync(path.join(directory, 'backend-state.json'));
    fs.rmdirSync(directory);
  });
  const stateFile = path.join(directory, 'backend-state.json'), calls = [];
  const send = async (_, command) => {
    calls.push(command);
    if (calls.length === 1) return { code: 1, body: { status: 'failed', error_code: 'operation_not_found' } };
    if (calls.length === 2) return { code: 0, body: ready() };
    if (calls.length === 3 && command.startsWith('upload ')) return reply;
    throw new Error('Unexpected effect after the upload response');
  };
  const state = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  return { stateFile, calls, send, state };
}
const knownUploadErrors = ['incoming_quota_reached_operator_cleanup_required', 'insufficient_upload_headroom',
  'prior_update_requires_reconciliation', 'upload_already_recorded_no_automatic_replay'];
const rejectedUpload = error_code => ({ code: 1, body: { schema_version: 1, status: 'failed', error_code,
  automatic_retry_allowed: false } });

for (const code of knownUploadErrors) {
  test(`known upload rejection ${code} is durable and never submits deployment or retries`, async t => {
    const f = uploadFixture(t, rejectedUpload(code));
    await assert.rejects(deployBackend({ ...options, stateFile: f.stateFile, send: f.send }),
      error => error instanceof CdRejected && error.message === code);
    assert.deepEqual(f.state(), { operation_id: id, automatic_retry_allowed: false,
      status: 'upload_rejected', deployment_requested: false, error_code: code });
    assert.deepEqual(f.calls, [`status ${id}`, 'status', `upload 20 ${'e'.repeat(64)} 10 1 123`]);
  });
}

test('untrusted or contradictory rejection responses remain unknown without leaking remote fields', async t => {
  const valid = rejectedUpload(knownUploadErrors[0]);
  const cases = [
    ['extra fields', { ...valid, body: { ...valid.body, Authorization: 'private-transport-secret' } }],
    ['unknown code', rejectedUpload('private_secret_in_lowercase')],
    ['schema mismatch', { ...valid, body: { ...valid.body, schema_version: 2 } }],
    ['schema string', { ...valid, body: { ...valid.body, schema_version: '1' } }],
    ['wrong status', { ...valid, body: { ...valid.body, status: 'uploaded' } }],
    ['retry enabled', { ...valid, body: { ...valid.body, automatic_retry_allowed: true } }],
    ['missing retry flag', { ...valid, body: { schema_version: 1, status: 'failed', error_code: knownUploadErrors[0] } }],
    ['successful exit', { ...valid, code: 0 }],
    ['exit outside range', { ...valid, code: 256 }],
    ['fractional exit', { ...valid, code: 1.5 }],
    ['string exit', { ...valid, code: '1' }],
    ['unknown exit', { ...valid, code: null }],
    ['missing body', { code: 1, body: null }],
    ['array body', { code: 1, body: [valid.body] }],
  ];
  for (const [name, response] of cases) await t.test(name, async t => {
    const f = uploadFixture(t, response);
    await assert.rejects(deployBackend({ ...options, stateFile: f.stateFile, send: f.send }),
      error => error instanceof CdRejected && error.message === 'backend_upload_outcome_unknown');
    assert.deepEqual(f.state(), { operation_id: id, automatic_retry_allowed: false,
      status: 'upload_requested', deployment_requested: false });
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls.filter(command => command.startsWith('upload ')).length, 1);
    assert.equal(f.calls.filter(command => command.startsWith('deploy ')).length, 0);
    assert.doesNotMatch(JSON.stringify(f.state()), /private|Authorization/);
  });
});

test('a disconnected upload retains its uncertain intent without another upload or deployment', async t => {
  const f = uploadFixture(t, null);
  await assert.rejects(deployBackend({ ...options, stateFile: f.stateFile,
    send: async (...args) => {
      if (f.calls.length === 2) {
        f.calls.push(args[1]);
        throw new CdRejected('ssh_effect_or_status_outcome_unknown');
      }
      return f.send(...args);
    } }), /ssh_effect_or_status_outcome_unknown/);
  assert.equal(f.state().status, 'upload_requested');
  assert.equal(f.state().deployment_requested, false);
  assert.equal(f.state().automatic_retry_allowed, false);
  assert.equal(f.calls.length, 3);
});
