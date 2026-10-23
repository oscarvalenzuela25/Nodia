// Actual CodexRpc initializer and exact policy, isolated binary, no account/turn.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.argv[2];
assert(root?.startsWith('/opt/nodia/verification/ai39-channel-process-'));
const binary = '/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex';
const binarySha = createHash('sha256').update(await readFile(binary)).digest('hex');
assert.equal(binarySha, '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');
const { CodexRpc } = await import(pathToFileURL(join(root, 'dist/common/ai/codex/codex-rpc.js')));
const { CODEX_PROVIDER } = await import(pathToFileURL(join(root, 'dist/common/ai/codex/codex-contract.js')));
const profile = await mkdtemp(join(root, 'profile-'));
const home = await mkdtemp(join(root, 'home-'));
const work = await mkdtemp(join(root, 'work-'));
const rpc = new CodexRpc(binary, work, profile, home);
const actualRequest = rpc.request.bind(rpc);
const requested = [];
rpc.request = (method, ...rest) => {
  requested.push(method);
  return actualRequest(method, ...rest);
};
const notifications = new Set();
rpc.on('notification', (method) => notifications.add(method));
let initialized = false;
let ephemeral = false;
try {
  await rpc.initialize({ experimentalChatApi: true });
  initialized = true;
  const thread = await rpc.request('thread/start', {
    cwd: work, ephemeral: true, approvalPolicy: 'never', sandbox: 'read-only',
    modelProvider: CODEX_PROVIDER,
    dynamicTools: [{ name: 'nodia_ai39_protocol_probe', description: 'Synthetic offline schema probe.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] } }],
  });
  ephemeral = typeof thread.thread?.id === 'string' && thread.thread?.ephemeral === true;
  assert(ephemeral);
} finally { await rpc.close(); }
let absent = false;
try { await lstat(`/proc/${rpc.ownedPid}`); } catch (error) { absent = error.code === 'ENOENT'; }
assert(absent);
let authAbsent = false;
try { await lstat(join(profile, 'auth.json')); } catch (error) { authAbsent = error.code === 'ENOENT'; }
assert(authAbsent);
assert.deepEqual(requested, ['initialize', 'config/read', 'thread/start']);
console.log(JSON.stringify({ task: 'AI39-native-initializer-r01',
  checks: 5, all_passed: initialized && ephemeral && absent && authAbsent,
  binary_sha256: binarySha, actual_production_initializer: true,
  effective_codex_settings_validated_by_initializer: initialized,
  ephemeral_thread_with_dynamic_tools_accepted: ephemeral,
  requested_methods: requested, notification_methods: [...notifications].sort(),
  owned_native_pid: rpc.ownedPid, owned_native_process_reaped: absent,
  synthetic_profile_auth_file_absent: authAbsent, provider_inference_requests: 0,
  model_list_requests: 0, account_read_requests: 0, login_requests: 0,
  personal_or_connection_profiles_opened: false, native_tool_callback_verified: false,
  test_script_sha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
}, null, 2));
