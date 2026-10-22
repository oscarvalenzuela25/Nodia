import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const identity = '00000000-0000-0000-0000-000000000001';
const state = { attached: true, last_phase: 'generation_completed', cancelled_at_phase: null, elapsed_ms: 20, http_status: 200, byte_chunks: 1, body_bytes: 14, candidate_outputs: 1, activity_calls: 1, recovery_calls: 0, client_close_calls: 0, events: [{phase: 'request_started', task_role: 'generation', elapsed_ms: 1}], sink_errors: 0 };
const invoke = input => {
  const result = spawnSync(process.env.NODIA_TEST_PYTHON || 'python', ['docs/evidence/scripts/read-nodia-ai-web-diagnostics.py'], { input, encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stderr, ''); return result.stdout.trim();
};
const line = (marker, data) => marker + ' ' + JSON.stringify(data) + '\n';
const success = { attempt_id: identity, web_generation: state };
assert.equal(JSON.parse(invoke(line('nodia_ai_web_success', success))).event, 'web_success');
assert.equal(JSON.parse(invoke(line('nodia_ai_web_cancelled', {...success, phase:'generation'}))).event, 'web_cancelled');
assert.equal(JSON.parse(invoke(line('nodia_ai_web_progress', {attempt_id:identity, phase:'request_started', task_role:'generation',elapsed_ms:1}))).event, 'web_progress');
assert.equal(JSON.parse(invoke(line('nodia_ai_chat_failure', {attempt_id:identity, engine:'web', phase:'generation',error_type:'TimeoutError',elapsed_ms:119003}))).event, 'web_failure');
const changes = [{ raw: 'private-do-not-export' }, { http_status: true }, { byte_chunks: -1 }, { body_bytes: 2147483648 }, { events: Array(17).fill(state.events[0]) }, { last_phase: [] }, { attached: 'true' }, { events: [{...state.events[0],phase:'private-do-not-export'}] }, {events:[{...state.events[0],task_role:'private-do-not-export'}]}, {events:[{...state.events[0],elapsed_ms:true}]}, {cancelled_at_phase:'private-do-not-export'}];
for (const change of changes) assert.equal(invoke(line('nodia_ai_web_success', {...success,web_generation:{...state,...change}})), '');
assert.equal(invoke(line('nodia_ai_web_success', {...success, raw:'private-do-not-export'})), '');
assert.equal(invoke(line('nodia_ai_web_success', {...success, attempt_id:'private-do-not-export'})), '');
assert.equal(invoke('x'.repeat(131073)+'\n'+line('nodia_ai_web_success',success)), '');
assert.equal(invoke('nodia_ai_web_success invalid-json\n'), '');
console.log(JSON.stringify({ task:'AI-15 Web diagnostic projection', checks:changes.length+8, status:'passed', provider_calls:0 }));

