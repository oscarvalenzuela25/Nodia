// Plan90 retires the former Web -> Agentic dispatch harness. This successor exercises
// rejection before persistence/observation plus immutable historical read projection.
// Shared worker fences, ACK, unknown/no-replay and cancellation remain exercised in
// nodia-ai-ai11.integration.mjs, nodia-ai-ai12.integration.mjs and nodia-ai-ai36-c05-selection.integration.mjs.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { loadAi } from './nodia-ai.integration.fixture.mjs';

const project = await loadAi('nodia-ai-conversation/use-case/historical-ai-snapshots', 'projectHistoricalAiSnapshots');
const validate = await loadAi('nodia-ai-conversation/dto/nodia-ai-validation', 'validateNodiaAiDto');
const Selection = await loadAi('nodia-ai-conversation/dto/nodia-ai-selection.dto', 'NodiaAiSelectionDto');
const Routing = await loadAi('nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case', 'UpdateNodiaAiRoutingUseCase');
let forbiddenCalls = 0;
const forbidden = new Proxy({}, { get() { forbiddenCalls++; throw Error('Persistence/provider must not execute'); } });
const selection = { connection_id: '9007199254740993', mode: 'agentic', model_id: 'synthetic-historical-model', effort_id: null };
const disabled = { schema_version: 1, enabled: false, revision: 1, target: null };
let checks = 0;
for (const mode of ['token_plan_web', 'token_plan_agentic', 'retired', 'web_session']) {
  assert.throws(() => validate(Selection, { ...selection, mode }));
  checks++;
}
for (const mode of ['agentic', 'api_key']) {
  assert.equal(validate(Selection, { ...selection, mode }).mode, mode);
  checks++;
}
const routing = new Routing(forbidden, forbidden, forbidden, forbidden, forbidden);
await assert.rejects(routing.execute({ userId: '1', sessionId: randomUUID() }, randomUUID(), {
  enabled: true, expected_conversation_revision: 1, expected_routing_revision: 1,
  target: { selection, configuration_generation: 'a'.repeat(64), session_generation: 'b'.repeat(32) },
}), error => error.getStatus?.() === 400);
assert.equal(forbiddenCalls, 0);
checks++;
const oldSelection = { ...selection, mode: 'token_plan_web' };
const oldRouting = { ...disabled, enabled: true, target: { selection: { ...selection, mode: 'token_plan_agentic' },
  configuration_generation: 'a'.repeat(64), session_generation: 'b'.repeat(32) } };
const original = JSON.stringify([oldSelection, oldRouting]);
const originalHash = createHash('sha256').update(original).digest('hex');
const historical = project(oldSelection, oldRouting);
assert.equal(historical.selection.mode, 'retired');
assert.equal(historical.routing.enabled, true);
assert.equal(historical.routing.target.selection.mode, 'agentic');
assert.equal(createHash('sha256').update(JSON.stringify([oldSelection, oldRouting])).digest('hex'), originalHash);
checks++;
assert.throws(() => project(oldSelection, { ...oldRouting, target: { ...oldRouting.target,
  selection: { ...oldRouting.target.selection, connection_id: '2' } } }));
checks++;
assert.equal(project({ ...selection, mode: 'token_plan_agentic' }, disabled).selection.mode, 'agentic');
checks++;
console.log(JSON.stringify({ stage: 'AI-12-routing-retirement', scope: 'compiled_rejection_and_historical_projection_only',
  checks, database_calls: 0, provider_inferences: 0, original_snapshot_sha256: originalHash }));
