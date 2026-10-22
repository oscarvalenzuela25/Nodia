import { describe, expect, it } from 'vitest';
import { ValidateNodiaAiSnapshotsUseCase } from './validate-nodia-ai-snapshots.use-case.js';
import type { NodiaAiBudgetSnapshot } from '../types/nodia-ai-persistence.types.js';
const maximum: NodiaAiBudgetSnapshot = {
  schema_version: 1,
  tool_calls: 12,
  mcp_rpc_messages: 128,
  provider_dispatches: 3,
  compactions: 1,
  delegations: 1,
};
const selection = {
  connection_id: '9007199254740993',
  mode: 'token_plan_web',
  model_id: 'synthetic-source',
  effort_id: null,
};
const target = {
  selection: {
    ...selection,
    mode: 'token_plan_agentic',
    model_id: 'synthetic-target',
    effort_id: 'configured-effort',
  },
  configuration_generation: 'config-1',
  session_generation: 'session-1',
};
function valid() {
  return {
    base_selection: selection,
    routing: { schema_version: 1, enabled: false, revision: 1, target: null },
    budget: maximum,
    usage: {
      tool_calls: 0,
      mcp_rpc_messages: 0,
      provider_dispatches: 0,
      compactions: 0,
      delegations: 0,
    },
    stage: null,
  };
}
const subject = new ValidateNodiaAiSnapshotsUseCase();
describe('ValidateNodiaAiSnapshotsUseCase', () => {
  it('accepts exact immutable snapshots with zero usage without activating routing', () => {
    expect(subject.execute(valid(), maximum)).toEqual(valid());
  });
  it('accepts a delegated stage on its exact consented connection/model/effort', () => {
    const input = {
      ...valid(),
      routing: { schema_version: 1, enabled: true, revision: 2, target },
      usage: { ...valid().usage, delegations: 1 },
      stage: {
        stage_seq: 2,
        stage_key: 'delegated-1',
        routing_phase: 'delegated',
        selection: target.selection,
      },
    };
    expect(subject.execute(input, maximum).stage?.selection).toEqual(
      target.selection,
    );
  });
  it.each([
    { ...valid(), secret: 'synthetic' },
    { ...valid(), base_selection: { ...selection, effort_id: undefined } },
    {
      ...valid(),
      routing: { schema_version: 1, enabled: true, revision: 1, target: null },
    },
    {
      ...valid(),
      routing: { schema_version: 2, enabled: false, revision: 1, target: null },
    },
    {
      ...valid(),
      routing: {
        schema_version: 1,
        enabled: false,
        revision: 1,
        target: {
          ...target,
          selection: { ...target.selection, connection_id: '2' },
        },
      },
    },
    {
      ...valid(),
      routing: {
        schema_version: 1,
        enabled: false,
        revision: 1,
        target: {
          ...target,
          selection: { ...target.selection, mode: 'api_key' },
        },
      },
    },
    {
      ...valid(),
      routing: {
        schema_version: 1,
        enabled: false,
        revision: 1,
        target: { ...target, session_generation: '' },
      },
    },
    { ...valid(), budget: { ...maximum, provider_dispatches: 0 } },
    { ...valid(), budget: { ...maximum, tool_calls: 13 } },
    { ...valid(), budget: { ...maximum, provider_dispatches: 0.5 } },
    { ...valid(), usage: { ...valid().usage, tool_calls: -1 } },
    { ...valid(), usage: { ...valid().usage, tool_calls: 13 } },
    { ...valid(), usage: { ...valid().usage, delegations: true } },
    { ...valid(), usage: { ...valid().usage, mcp_rpc_messages: '0' } },
    {
      ...valid(),
      stage: {
        stage_seq: 1,
        stage_key: 'base',
        routing_phase: 'base',
        selection: { ...selection, model_id: 'unexpected-model' },
      },
    },
    {
      ...valid(),
      stage: {
        stage_seq: 2,
        stage_key: 'delegated',
        routing_phase: 'delegated',
        selection: target.selection,
      },
    },
    {
      ...valid(),
      routing: { schema_version: 1, enabled: true, revision: 1, target },
      usage: { ...valid().usage, delegations: 1 },
      stage: {
        stage_seq: 2,
        stage_key: 'delegated',
        routing_phase: 'delegated',
        selection: { ...target.selection, effort_id: 'unconsented-effort' },
      },
    },
  ])(
    'rejects incompatible routing, forged provenance or a budget mismatch (%j)',
    (input) => {
      expect(() => subject.execute(input, maximum)).toThrow(
        'nodia_ai:invalid_input',
      );
    },
  );
  it.each(['constructor', '__proto__', 'prototype'])(
    'rejects reserved nested routing keys before parsing (%s)',
    (key) => {
      const input = JSON.parse(
        JSON.stringify({
          ...valid(),
          routing: {
            schema_version: 1,
            enabled: true,
            revision: 1,
            target: { ...target, [key]: {} },
          },
        }),
      );
      expect(() => subject.execute(input, maximum)).toThrow(
        'nodia_ai:invalid_input',
      );
    },
  );
  it('rejects an oversized stage key before persistence', () => {
    expect(() =>
      subject.execute(
        {
          ...valid(),
          stage: {
            stage_seq: 1,
            stage_key: 'x'.repeat(129),
            routing_phase: 'base',
            selection,
          },
        },
        maximum,
      ),
    ).toThrow('nodia_ai:invalid_input');
  });
  it('accepts base provenance only on the unchanged admitted selection', () => {
    expect(
      subject.execute(
        {
          ...valid(),
          stage: {
            stage_seq: 1,
            stage_key: 'base-1',
            routing_phase: 'base',
            selection,
          },
        },
        maximum,
      ).stage?.routing_phase,
    ).toBe('base');
  });
});
