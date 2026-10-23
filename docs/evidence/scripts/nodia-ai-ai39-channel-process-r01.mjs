// Isolated Linux integration: actual JSONL streams/process ownership, synthetic
// app-server peer and gateway. No .env, account, login, network or inference.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.argv[2];
assert(root?.startsWith('/opt/nodia/verification/ai39-channel-process-'));
const { CodexRpc } = await import(pathToFileURL(join(root, 'dist/common/ai/codex/codex-rpc.js')));
const { CodexChatToolChannelUseCase } = await import(pathToFileURL(join(root, 'dist/ai-provider/use-case/codex-chat-tool-channel.use-case.js')));
const contractUrl = pathToFileURL(join(root, 'dist/common/ai/codex/codex-contract.js')).href;
const peerSource = `#!/usr/local/bin/node
import {createInterface} from 'node:readline';
import {CODEX_SETTINGS} from ${JSON.stringify(contractUrl)};
const waiting=new Map();
const send=(message)=>process.stdout.write(JSON.stringify(message)+'\\n');
let serial=0;
for await (const line of createInterface({input:process.stdin})) {
 const message=JSON.parse(line);
 if(!message.method) {
   const original=waiting.get(message.id);
   if(original!==undefined) {waiting.delete(message.id);send({id:original,result:message});}
   continue;
 }
 if(message.method==='initialize') send({id:message.id,result:{}});
 else if(message.method==='config/read') send({id:message.id,result:{config:CODEX_SETTINGS}});
 else if(message.method==='peer/call') {
   const id='native-tool-'+(++serial);waiting.set(id,message.id);
   send({id,method:message.params.method,params:message.params.params});
 }
}
`;
const peer = join(root, 'synthetic-peer.mjs');
await writeFile(peer, peerSource, { mode: 0o700, flag: 'wx' });
const checks = [];
const checked = (name, condition) => { assert(condition, name); checks.push(name); };
const params = (callId, changes = {}) => ({ threadId: 'synthetic-thread', turnId: 'synthetic-turn',
  tool: 'nodia_synthetic_read', callId, arguments: { status: false }, namespace: null, ...changes });
const invoke = (rpc, callId, changes = {}, method = 'item/tool/call') =>
  rpc.request('peer/call', { method, params: params(callId, changes) }, 2000);
let callbacks = 0;
let requests = 0;
const pids = [];
const actualClosed = [];
for (const experimental of [false, true]) {
  const profile = await mkdtemp(join(root, 'profile-'));
  const home = await mkdtemp(join(root, 'home-'));
  const work = await mkdtemp(join(root, 'work-'));
  const rpc = new CodexRpc(peer, work, profile, home);
  pids.push(rpc.ownedPid);
  try {
    await rpc.initialize({ experimentalChatApi: experimental });
    const initial = await invoke(rpc, 'before');
    checked(`uninstalled-channel-denies-${experimental}`, initial.error?.code === -32601);
    const controller = new AbortController();
    const channel = new CodexChatToolChannelUseCase().execute({
      threadId: 'synthetic-thread', turnId: 'synthetic-turn', toolNames: ['nodia_synthetic_read'],
      deadlineAt: new Date(Date.now() + 15000), signal: controller.signal,
      limits: { requests: 10, toolCalls: 5, argumentUtf8Bytes: 512, resultUtf8Bytes: 512,
        jsonDepth: 8, collectionItems: 50 },
      assertLease: async (signal) => signal.throwIfAborted(),
      beforeRequest: async (_count, signal) => { signal.throwIfAborted(); requests++; },
      onToolCall: async (_call, signal) => { signal.throwIfAborted(); callbacks++; return { total: 0, unknown: null }; },
    });
    if (!experimental) {
      assert.throws(() => rpc.openChatToolChannel(channel));
      checked('ocr-cannot-install-chat-channel', callbacks === 0);
      channel.close();
      continue;
    }
    const detach = rpc.openChatToolChannel(channel);
    const good = await invoke(rpc, 'good');
    checked('native-response-text-envelope', good.result?.success === true &&
      good.result.contentItems?.[0]?.type === 'inputText' &&
      good.result.contentItems?.[0]?.text === '{"total":0,"unknown":null}');
    const replay = await invoke(rpc, 'good');
    checked('replay-blocked-before-gateway', replay.error?.code === -32600 && callbacks === 1);
    const foreign = await invoke(rpc, 'foreign', { turnId: 'another-turn' });
    checked('foreign-turn-denied', foreign.error?.code === -32600 && callbacks === 1);
    const shell = await invoke(rpc, 'shell', {}, 'item/commandExecution/requestApproval');
    checked('permissions-denied', shell.error?.code === -32600 && callbacks === 1);
    detach();
    const after = await invoke(rpc, 'after');
    checked('detach-restores-ocr-denial', after.error?.code === -32601 && callbacks === 1);
  } finally {
    await rpc.close();
    checked(`rpc-closed-${experimental}`, rpc.alive === false);
    const pid = rpc.ownedPid;
    let absent = false;
    try { await lstat(`/proc/${pid}`); } catch (error) { absent = error.code === 'ENOENT'; }
    checked(`owned-process-reaped-${experimental}`, absent);
    actualClosed.push(absent);
  }
}
checked('gateway-executed-once', callbacks === 1);
checked('admitted-request-hook-counts-rejections', requests === 4);
const result = { task: 'AI39-channel-process-r01', mode: 'isolated_real_jsonl_synthetic_peer',
  checks: checks.length, all_passed: true, check_names: checks, native_pids: pids,
  owned_children_reaped: actualClosed.every(Boolean), gateway_callbacks: callbacks,
  admitted_request_budget_hooks: requests, real_business_effects: 0,
  provider_inference_requests: 0, account_or_connection_profiles_opened: false,
  test_script_sha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  limits: ['Synthetic peer does not prove native tool invocation or durable gateway/leases.',
    'Local overflow requires the future adapter to account for all RPC frames.',
    'Stopping a tool channel is not a terminal native proof or a release of a runtime slot.'] };
console.log(JSON.stringify(result, null, 2));
