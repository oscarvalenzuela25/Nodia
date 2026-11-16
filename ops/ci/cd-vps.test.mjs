import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deployBackend, operationId, operationAbsent, requireReady, sshCommand } from './cd-vps.mjs';
import { uploadId, uploadIdentity } from './cd-upload.mjs';
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
const options = {environment,plan:{server_required:true,source_sha:next,server_base:old,server_upload_protocol_version:1},artifact,ci,zipFile:'unused-fixture.zip',zipBytes:123,
  expectedRelease:release(old,oldTree),expectedTree:oldTree,candidateRelease:release(next,tree),candidateTree:tree,
  sshOptions:{expectedFingerprint},sleep:async()=>{},pollLimit:2};
test('backend transport submits once, verifies artifact receipt and confirms both healthy writers', async () => {
  const calls=[];
  const replies=[operationMissing,{code:0,body:ready()},
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
  await assert.rejects(deployBackend({...options,allowNewSubmission:false,send:async()=>++calls===1?operationMissing:{code:0,body:ready()}}),/prior_cd_run/);
  assert.equal(calls,2);
  await assert.rejects(deployBackend({...options,send:async()=>({code:0,body:operation('unknown')})}),/requires_reconciliation/);
  assert.throws(()=>requireReady({...ready(),blocked:true}));assert.throws(()=>requireReady({...ready(),application:{api_active:true,worker_active:false}}));
});

const unchangedOptions = { ...options, plan: { ...options.plan, server_content_equivalence_allowed: true },
  candidateTree: oldTree, candidateRelease: release(next, oldTree) };
const operationMissing = { code: 1, body: { schema_version: 1, status: 'failed',
  error_code: 'operation_not_found', automatic_retry_allowed: false } };
function statusOnlySend(body = ready()) {
  const calls = [];
  return { calls, send: async (_, command) => {
    calls.push(command);
    if (calls.length === 1) return operationMissing;
    if (calls.length === 2 && command === 'status') return { code: 0, body };
    throw new Error('Unexpected effect while comparing backend package content');
  } };
}

test('identical package content keeps the deployed source and records a distinct candidate without upload or deployment', async t => {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-cd-unchanged-'));
  const stateFile = path.join(directory, 'backend-state.json');
  t.after(() => { if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile); fs.rmdirSync(directory); });
  const f = statusOnlySend();
  const result = await deployBackend({ ...unchangedOptions, stateFile, send: f.send });
  assert.deepEqual(result, { status: 'content_unchanged', source_sha: old, release_id: release(old, oldTree),
    package_tree_sha256: oldTree, candidate_source_sha: next, deployment_requested: false, deployment_performed: false });
  assert.notEqual(result.source_sha, ci.source_sha);
  assert.deepEqual(f.calls, [`status ${id}`, 'status']);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')), {
    operation_id: id, automatic_retry_allowed: false, ...result });
});

test('identical content cannot bypass the expected baseline or an earlier uncertain CD intention', async t => {
  const cases = [
    ['changed release', { expectedRelease: release('f'.repeat(40), oldTree) }, /backend_changed_after_plan/],
    ['changed tree', { expectedTree: tree }, /backend_changed_after_plan/],
    ['changed source', { plan: { ...unchangedOptions.plan, server_base: 'f'.repeat(40) } }, /backend_changed_after_plan/],
    ['prior CD run', { allowNewSubmission: false }, /prior_cd_run_requires_operator_reconciliation/],
  ];
  for (const [name, overrides, code] of cases) await t.test(name, async () => {
    const f = statusOnlySend();
    await assert.rejects(deployBackend({ ...unchangedOptions, ...overrides, send: f.send }), code);
    assert.deepEqual(f.calls, [`status ${id}`, 'status']);
  });
});

test('matching content never hides an existing active, failed or unknown operation or a malformed status', async t => {
  for (const phase of ['failed', 'unknown', 'preparing']) await t.test(phase, async () => {
    const calls = [];
    await assert.rejects(deployBackend({ ...unchangedOptions, pollLimit: 1, send: async (_, command) => {
      calls.push(command); return { code: 0, body: operation(phase) };
    } }), phase === 'preparing' ? /backend_operation_poll_deadline_requires_reconciliation/ : /backend_operation_requires_reconciliation/);
    assert.deepEqual(calls, [`status ${id}`]);
  });
  const calls = [];
  await assert.rejects(deployBackend({ ...unchangedOptions, send: async (_, command) => {
    calls.push(command); return { code: 0, body: { status: 'failed', error_code: 'operation_not_found' } };
  } }), /existing_backend_operation_requires_reconciliation/);
  assert.deepEqual(calls, [`status ${id}`]);
});

test('unqualified plans and a shared digest prefix keep the normal upload path', async t => {
  const sharedPrefixTree = oldTree.slice(0, 12) + 'c'.repeat(52);
  const cases = [
    ['missing equivalence qualification', { plan: options.plan }],
    ['explicitly unqualified plan', { plan: { ...options.plan, server_content_equivalence_allowed: false } }],
    ['truthy qualification is not approval', { plan: { ...options.plan, server_content_equivalence_allowed: 'true' } }],
    ['same prefix is different content', { candidateTree: sharedPrefixTree, candidateRelease: release(next, sharedPrefixTree) }],
  ];
  for (const [name, overrides] of cases) await t.test(name, async () => {
    const calls = [];
    await assert.rejects(deployBackend({ ...unchangedOptions, ...overrides, send: async (_, command) => {
      calls.push(command);
      if (calls.length === 1) return operationMissing;
      if (calls.length === 2) return { code: 0, body: ready() };
      if (command.startsWith('upload ')) return { code: 1, body: { schema_version: 1, status: 'failed',
        error_code: 'insufficient_upload_headroom', automatic_retry_allowed: false } };
      throw new Error('Unexpected deployment after rejected upload');
    } }), /insufficient_upload_headroom/);
    assert.deepEqual(calls, [`status ${id}`, 'status', `upload 20 ${'e'.repeat(64)} 10 1 123`]);
  });
});

test('content comparison cannot treat blocked, unhealthy or error-bearing readiness as a positive result', async t => {
  const cases = [
    ['blocked', { ...ready(), blocked: true }],
    ['unhealthy writer', { ...ready(), application: { api_active: true, worker_active: false } }],
    ['hidden error', { ...ready(), error_code: 'synthetic-private-diagnostic' }],
    ['hidden current field', { ...ready(), current: { ...ready().current, error_code: 'synthetic-private-diagnostic' } }],
  ];
  for (const [name, body] of cases) await t.test(name, async () => {
    const f = statusOnlySend(body);
    await assert.rejects(deployBackend({ ...unchangedOptions, send: f.send }), error =>
      error instanceof CdRejected && error.message === 'deployment_gateway_not_ready');
    assert.deepEqual(f.calls, [`status ${id}`, 'status']);
  });
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
    if (calls.length === 1) return operationMissing;
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

test('only an exact failed operation lookup may authorize a new application intention', async () => {
  assert.equal(operationAbsent(operationMissing), true);
  for (const invalid of [
    { code: null }, { code: 0 }, { code: 256 }, { code: 1.5 }, { code: '1' },
    { body: { ...operationMissing.body, automatic_retry_allowed: true } },
    { body: { ...operationMissing.body, deployment_requested: true } },
    { body: { ...operationMissing.body, effects_started: true } },
    { body: { ...operationMissing.body, schema_version: '1' } },
    { body: { status: 'failed', error_code: 'operation_not_found' } },
  ]) {
    const value = { ...operationMissing, ...invalid }; assert.equal(operationAbsent(value), false);
    let calls = 0;
    await assert.rejects(deployBackend({ ...options, send: async () => { calls++; return value; } }), /requires_reconciliation/);
    assert.equal(calls, 1);
  }
});

test('v2 byte proof is required before a single deploy; prior CD origin never enters transfer recovery', async () => {
  const v2 = { ...options, plan: { ...options.plan, server_upload_protocol_version: 2 } };
  const proof = { upload_protocol_version: 2, upload_id: uploadId(uploadIdentity(artifact, ci, options.zipBytes)),
    upload_phase: 'verified', upload_offset: options.zipBytes, upload_bytes: options.zipBytes, upload_recovered: true };
  let transfers = 0; const calls = [];
  const replies = [operationMissing, { code: 0, body: ready() },
    { code: 0, body: { schema_version: 1, status: 'submitted', operation_id: id, phase: 'submitted',
      deployment_requested: true, automatic_retry_allowed: false } }, { code: 0, body: operation('complete') }, { code: 0, body: ready(next, tree) }];
  const result = await deployBackend({ ...v2, transfer: async () => { transfers++; return proof; },
    send: async (_, command) => { calls.push(command); return replies.shift(); } });
  assert.equal(result.status, 'complete'); assert.equal(transfers, 1);
  assert.equal(calls.filter(x => x.startsWith('deploy ')).length, 1);
  await assert.rejects(deployBackend({ ...v2, allowNewSubmission: false, transfer: async () => { transfers++; return proof; },
    send: async (_, command) => command === 'status' ? { code: 0, body: ready() } : operationMissing }), /prior_cd_run/);
  assert.equal(transfers, 1);
  await assert.rejects(deployBackend({ ...v2, transfer: async () => ({ ...proof, upload_phase: 'receiving' }),
    send: async (_, command) => command === 'status' ? { code: 0, body: ready() } : operationMissing }), /upload_status_invalid/);
});

test('SSH streaming sends only the verified inclusive byte range', async t => {
  const parent = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-ssh-range-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const file = path.join(parent, 'artifact.zip'); fs.writeFileSync(file, '0123456789');
  const program = "let b='';process.stdin.on('data',x=>b+=x).on('end',()=>process.stdout.write(JSON.stringify({body:b})));";
  const reply = await sshCommand({ program: process.execPath, args: ['-e', program], options: { env: process.env } }, 'fixture',
    { inputFile: file, start: 3, end: 6 });
  assert.equal(reply.code, 0); assert.deepEqual(reply.body, { body: '3456' });
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
