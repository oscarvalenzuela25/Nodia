import { describe, expect, it } from 'vitest';
import { projectHistoricalAiSnapshots } from './historical-ai-snapshots.js';
import { ValidateNodiaAiSnapshotsUseCase } from './validate-nodia-ai-snapshots.use-case.js';

const selection = { connection_id: '9007199254740993', mode: 'token_plan_agentic', model_id: 'synthetic-dynamic', effort_id: null };
const routing = { schema_version: 1, enabled: false, revision: 1, target: null };
describe('historical AI snapshots (read projection only)', () => {
  it('normalizes the historical Agentic label without changing stored snapshot bytes', () => {
    const before = JSON.stringify(selection);
    expect(projectHistoricalAiSnapshots(selection, routing).selection).toEqual({ ...selection, mode: 'agentic' });
    expect(JSON.stringify(selection)).toBe(before);
  });
  it('marks retired Web explicitly and preserves historical delegation provenance', () => {
    const source = { ...selection, mode: 'token_plan_web' };
    const original = { ...routing, enabled: true, target: { selection,
      configuration_generation: 'a'.repeat(64), session_generation: 'b'.repeat(32) } };
    const before = JSON.stringify([source, original]);
    const result = projectHistoricalAiSnapshots(source, original);
    expect(result.selection.mode).toBe('retired');
    expect(result.routing).toMatchObject({ enabled: true, target: { selection: { mode: 'agentic', connection_id: selection.connection_id } } });
    expect(JSON.stringify([source, original])).toBe(before);
  });
  it.each(['retired', 'web_session', 'unknown'])('never turns unrecognized persisted mode %s into Agentic', mode => {
    expect(() => projectHistoricalAiSnapshots({ ...selection, mode }, routing)).toThrow();
  });
  it('rejects forged cross-connection delegation and extra snapshot fields', () => {
    expect(() => projectHistoricalAiSnapshots({ ...selection, mode: 'token_plan_web' }, {
      ...routing, enabled: true, target: { selection: { ...selection, connection_id: '2' },
        configuration_generation: 'a'.repeat(64), session_generation: 'b'.repeat(32) } })).toThrow();
    expect(() => projectHistoricalAiSnapshots({ ...selection, secret: 'synthetic' }, routing)).toThrow();
  });
  it('does not widen the writable snapshot validator', () => {
    const budget = { schema_version: 1, tool_calls: 12, mcp_rpc_messages: 128, provider_dispatches: 3, compactions: 1, delegations: 1 };
    const usage = { tool_calls: 0, mcp_rpc_messages: 0, provider_dispatches: 0, compactions: 0, delegations: 0 };
    for (const mode of ['token_plan_agentic', 'token_plan_web', 'retired'])
      expect(() => new ValidateNodiaAiSnapshotsUseCase().execute({ base_selection: { ...selection, mode }, routing, budget, usage, stage: null }, budget)).toThrow();
  });
});
