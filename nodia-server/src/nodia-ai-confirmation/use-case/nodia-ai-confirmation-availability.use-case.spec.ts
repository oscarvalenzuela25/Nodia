import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION as workflow } from '../../nodia-ai-proposal/types/workflow.types.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
const registrations = [
  {
    toolName: 'supplier',
    contractHash: 'a'.repeat(64),
    catalogVersion: 'business/1',
    outputKeys: { id: 'provider_id' },
  },
  {
    toolName: 'contact',
    contractHash: 'b'.repeat(64),
    catalogVersion: 'business/1',
    bindableFields: { provider_id: 'provider_id' },
  },
  {
    toolName: 'financial',
    contractHash: 'c'.repeat(64),
    catalogVersion: 'finance/1',
  },
];
function setup(binding = true) {
  const first = Object.assign(new NodiaAiProposalStep(), {
    id: randomUUID(),
    position: 1,
    tool_name: 'supplier',
    contract_hash: registrations[0].contractHash,
    output_bindings: [],
    public_step: { depends_on: [], output_bindings: [] },
  });
  const bindings = binding
    ? [
        {
          target_field_key: 'provider_id',
          from_step_id: first.id,
          output_key: 'id',
        },
      ]
    : [];
  const second = Object.assign(new NodiaAiProposalStep(), {
    id: randomUUID(),
    position: 2,
    tool_name: 'contact',
    contract_hash: registrations[1].contractHash,
    output_bindings: bindings,
    public_step: {
      depends_on: binding ? [first.id] : [],
      output_bindings: bindings,
    },
  });
  return {
    first,
    second,
    steps: [first, second],
    availability: new NodiaAiConfirmationAvailabilityUseCase(registrations),
  };
}
describe('Execution admission for dependent workflows', () => {
  it('admits one secure operation but rejects a mixed or workflow secure execution', () => {
    const f = setup(false),
      secure = {
        toolName: 'nodia_secure_flows_prepare_connection_login',
        contractHash: 'e'.repeat(64),
        catalogVersion: 'secure/1',
      };
    f.first.tool_name = secure.toolName;
    f.first.contract_hash = secure.contractHash;
    const availability = new NodiaAiConfirmationAvailabilityUseCase([
      ...registrations,
      secure,
    ]);
    expect(availability.describe([f.first], 'secure/1').can_confirm).toBe(true);
    expect(availability.describe([f.first], workflow).can_confirm).toBe(false);
    expect(availability.describe(f.steps, workflow).can_confirm).toBe(false);
  });
  it('admits backward typed outputs only under the explicit workflow coordinator version', () => {
    const f = setup();
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(true);
    expect(f.availability.describe(f.steps, 'business/1').can_confirm).toBe(
      false,
    );
  });
  it('keeps a single legacy operation available under its native catalog', () => {
    const f = setup();
    expect(f.availability.describe([f.first], 'business/1').can_confirm).toBe(
      true,
    );
    expect(f.availability.describe([f.first], 'wrong/1').can_confirm).toBe(
      false,
    );
  });
  it('admits independent registered native operations from different family catalogs', () => {
    const f = setup(false);
    Object.assign(f.second, {
      tool_name: 'financial',
      contract_hash: registrations[2].contractHash,
    });
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(true);
  });
  it('rejects missing executors and changed native contracts without a fallback', () => {
    const f = setup();
    f.second.contract_hash = 'd'.repeat(64);
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
    f.second.tool_name = 'unknown';
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
  });
  it.each(['self', 'foreign', 'future'])(
    'rejects %s source references',
    (kind) => {
      const f = setup();
      f.second.output_bindings[0].from_step_id =
        kind === 'self' ? f.second.id : randomUUID();
      expect(
        f.availability.describe(
          kind === 'future' ? [f.second, f.first] : f.steps,
          workflow,
        ).can_confirm,
      ).toBe(false);
    },
  );
  it('rejects an unregistered output or target and incompatible types', () => {
    const f = setup();
    f.second.output_bindings[0].output_key = 'arbitrary_json_path';
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
    f.second.output_bindings[0].output_key = 'id';
    f.second.output_bindings[0].target_field_key = 'business_id';
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
  });
  it('requires each dependency to have a corresponding output binding and forbids duplicates', () => {
    const f = setup(false);
    f.second.public_step.depends_on = [f.first.id];
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
    const g = setup();
    g.second.public_step.depends_on = [g.first.id, g.first.id];
    expect(g.availability.describe(g.steps, workflow).can_confirm).toBe(false);
  });
  it('rejects duplicate target bindings or an incorrect ordered position', () => {
    const f = setup();
    f.second.output_bindings.push({ ...f.second.output_bindings[0] });
    expect(f.availability.describe(f.steps, workflow).can_confirm).toBe(false);
    const g = setup(false);
    g.second.position = 1;
    expect(g.availability.describe(g.steps, workflow).can_confirm).toBe(false);
  });
  it('never admits an empty set', () => {
    const f = setup();
    expect(f.availability.describe([], workflow).can_confirm).toBe(false);
  });
});
