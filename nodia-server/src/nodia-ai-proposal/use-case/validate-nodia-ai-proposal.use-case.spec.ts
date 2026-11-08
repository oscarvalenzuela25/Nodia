import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiProposalPreparer } from '../types/proposal-preparer.types.js';
import { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
import { proposalFixture } from './proposal.fixture.js';
function fixture() {
  const policy = runtimeFixture().policy;
  const preparer: NodiaAiProposalPreparer = {
    toolName: 'nodia_test_prepare',
    contractHash: 'a'.repeat(64),
    catalogVersion: 'test/1',
    moduleRoutes: ['/finance'],
    actionKeys: [],
    editableFields: { name: 'string' },
    bindableFields: { parent_id: 'record_id' },
    outputKeys: { id: 'record_id' },
    prepare: vi.fn(),
    applyEdits: vi.fn(),
    verifyAuthority: vi.fn(),
  };
  const validate = new ValidateNodiaAiProposalUseCase(
    [preparer],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const now = new Date('2026-10-16T12:00:00.000Z');
  const proposal = Object.assign(new NodiaAiProposal(), {
    id: randomUUID(),
    conversation_id: randomUUID(),
    actor_id: '1',
    current_revision: 1,
    created_at: now,
  });
  const revision = Object.assign(new NodiaAiProposalRevision(), {
    proposal_id: proposal.id,
    revision: 1,
    state: 'ready',
    hash: '',
    catalog_version: 'test/1',
    canonicalization_version: 'jcs-rfc8785/1',
    created_at: now,
    expires_at: new Date(now.getTime() + 900000),
  });
  const makeStep = (position = 1): NodiaAiProposalStep => {
    const id = randomUUID();
    return Object.assign(new NodiaAiProposalStep(), {
      id,
      proposal_id: proposal.id,
      proposal_revision: 1,
      position,
      tool_name: preparer.toolName,
      contract_hash: preparer.contractHash,
      kind: 'domain_change',
      effect_key: 'record.create',
      scope: { subject_user_id: '1' },
      command_template: { name: 'Comida', amount: '9007199254740993' },
      preconditions: { category_version: 'v1' },
      output_bindings: [],
      public_step: {
        step_id: id,
        tool_name: preparer.toolName,
        kind: 'domain_change',
        effect_key: 'record.create',
        target: null,
        scope: { subject_user_id: '1' },
        changes: [
          {
            field_key: 'name',
            before: null,
            after: 'Comida',
            before_present: false,
            after_present: true,
            origin: 'user',
          },
        ],
        depends_on: [],
        output_bindings: [],
      },
    });
  };
  const steps = [makeStep()];
  const seal = () => {
    revision.hash = String(
      validate.compile(proposal, revision, steps, false).hash,
    );
  };
  return { validate, proposal, revision, steps, makeStep, seal, preparer };
}
describe('Compile immutable NodiaAI proposal revisions', () => {
  it('validates an opted-in historical snapshot hash and common schema without executing its authority port', () => {
    const f = proposalFixture();
    f.preparer.verifyHistoricalReadAuthority = vi.fn();
    Object.assign(f.preparer, {
      contractHash: 'b'.repeat(64),
      catalogVersion: 'fixture/2',
    });
    expect(
      f.validate.compileHistorical(f.proposal, f.revision, [f.step]).hash,
    ).toBe(f.revision.hash);
    expect(f.preparer.verifyHistoricalReadAuthority).not.toHaveBeenCalled();
    expect(() => f.validate.compile(f.proposal, f.revision, [f.step])).toThrow(
      'nodia_ai:catalog_changed',
    );
    f.step.public_step.unrecognized = 'tampered';
    expect(() =>
      f.validate.compileHistorical(f.proposal, f.revision, [f.step]),
    ).toThrow('nodia_ai:invalid_persisted_state');
  });
  it('does not interpret historical workflow bindings through a new contract', () => {
    const f = proposalFixture();
    f.preparer.verifyHistoricalReadAuthority = vi.fn();
    Object.assign(f.preparer, { contractHash: 'b'.repeat(64) });
    f.step.output_bindings = [
      { from_step_id: f.step.id, target_field_key: 'name', output_key: 'id' },
    ];
    f.step.public_step.output_bindings = f.step.output_bindings;
    expect(() =>
      f.validate.compileHistorical(f.proposal, f.revision, [f.step]),
    ).toThrow('nodia_ai:catalog_changed');
  });
  it('reconstructs exact projection and command hash without invoking native preparation or authority', () => {
    const f = fixture();
    f.seal();
    const first = f.validate.compile(f.proposal, f.revision, f.steps);
    expect(first.hash).toBe(f.revision.hash);
    expect(first.steps).toEqual(f.steps.map((step) => step.public_step));
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.verifyAuthority).not.toHaveBeenCalled();
  });
  it('ignores object insertion order while preserving exact bigint strings', () => {
    const f = fixture();
    f.seal();
    f.steps[0].command_template = {
      amount: '9007199254740993',
      name: 'Comida',
    };
    expect(f.validate.compile(f.proposal, f.revision, f.steps).hash).toBe(
      f.revision.hash,
    );
  });
  it.each([
    'command',
    'projection',
    'scope',
    'preconditions',
    'actor',
    'expiry',
    'catalog',
  ])('detects a frozen %s mutation', (target) => {
    const f = fixture();
    f.seal();
    if (target === 'command') f.steps[0].command_template.name = 'Changed';
    if (target === 'projection')
      (f.steps[0].public_step.changes as NodiaAiJsonObject[])[0].after =
        'Changed';
    if (target === 'scope') f.steps[0].scope.subject_user_id = '2';
    if (target === 'preconditions')
      f.steps[0].preconditions.category_version = 'v2';
    if (target === 'actor') f.proposal.actor_id = '2';
    if (target === 'expiry')
      f.revision.expires_at = new Date(f.revision.expires_at.getTime() + 1);
    if (target === 'catalog') f.revision.catalog_version = 'test/2';
    expect(() => f.validate.compile(f.proposal, f.revision, f.steps)).toThrow();
  });
  it('does not hash lifecycle transitions as command changes', () => {
    const f = fixture();
    f.seal();
    f.revision.state = 'superseded';
    expect(f.validate.compile(f.proposal, f.revision, f.steps).hash).toBe(
      f.revision.hash,
    );
  });
  it.each(['self', 'future', 'foreign', 'duplicate'])(
    'rejects %s dependency references',
    (kind) => {
      const f = fixture();
      const second = f.makeStep(2);
      f.steps.push(second);
      if (kind === 'self') second.public_step.depends_on = [second.id];
      if (kind === 'future') f.steps[0].public_step.depends_on = [second.id];
      if (kind === 'foreign') second.public_step.depends_on = [randomUUID()];
      if (kind === 'duplicate')
        second.public_step.depends_on = [f.steps[0].id, f.steps[0].id];
      expect(() => f.seal()).toThrow();
    },
  );
  it('validates typed predecessor output bindings', () => {
    const f = fixture();
    const second = f.makeStep(2);
    f.steps.push(second);
    second.public_step.depends_on = [f.steps[0].id];
    second.output_bindings = [
      {
        from_step_id: f.steps[0].id,
        target_field_key: 'parent_id',
        output_key: 'id',
      },
    ];
    second.public_step.output_bindings = second.output_bindings;
    f.seal();
    expect(
      f.validate.compile(f.proposal, f.revision, f.steps).steps,
    ).toHaveLength(2);
  });
  it.each([
    'undeclared',
    'unknown_target',
    'unknown_output',
    'duplicate_target',
    'mismatch',
  ])('rejects %s output bindings', (kind) => {
    const f = fixture();
    const second = f.makeStep(2);
    f.steps.push(second);
    second.public_step.depends_on = [f.steps[0].id];
    second.output_bindings = [
      {
        from_step_id: f.steps[0].id,
        target_field_key: 'parent_id',
        output_key: 'id',
      },
    ];
    if (kind === 'undeclared') second.public_step.depends_on = [];
    if (kind === 'unknown_target')
      second.output_bindings[0].target_field_key = 'sql';
    if (kind === 'unknown_output')
      second.output_bindings[0].output_key = 'secret';
    if (kind === 'duplicate_target')
      second.output_bindings.push({ ...second.output_bindings[0] });
    if (kind === 'mismatch')
      (f.preparer.bindableFields as Record<string, string>).parent_id =
        'another_id';
    second.public_step.output_bindings = second.output_bindings;
    expect(() => f.seal()).toThrow();
  });
  it('rejects duplicated presentation keys and absent values hidden behind false presence flags', () => {
    const f = fixture();
    const changes = f.steps[0].public_step.changes as NodiaAiJsonObject[];
    changes.push({ ...changes[0] });
    expect(() => f.seal()).toThrow();
    changes.pop();
    changes[0].before = 'Hidden';
    expect(() => f.seal()).toThrow();
  });
  it('preserves full tagged arrays/objects and rejects duplicate object field keys', () => {
    const f = fixture();
    const changes = f.steps[0].public_step.changes as NodiaAiJsonObject[];
    changes[0].after = {
      kind: 'array',
      items: [
        {
          kind: 'object',
          fields: [
            { field_key: 'phone', value: null },
            { field_key: 'hours', value: '09:00' },
          ],
        },
      ],
    };
    f.seal();
    const expected = f.revision.hash;
    expect(f.validate.compile(f.proposal, f.revision, f.steps).hash).toBe(
      expected,
    );
    changes[0].after = {
      kind: 'object',
      fields: [
        { field_key: 'phone', value: null },
        { field_key: 'phone', value: 'x' },
      ],
    };
    expect(() => f.seal()).toThrow();
  });
  it('rejects unregistered contracts, bad positions, no steps and budget excess', () => {
    const f = fixture();
    f.steps[0].contract_hash = 'b'.repeat(64);
    expect(() => f.seal()).toThrow();
    f.steps[0].contract_hash = f.preparer.contractHash;
    f.steps[0].position = 2;
    expect(() => f.seal()).toThrow();
    f.steps.splice(0);
    expect(() => f.seal()).toThrow();
    for (let n = 1; n <= 9; n++) f.steps.push(f.makeStep(n));
    expect(() => f.seal()).toThrow();
  });
  it('maps corrupt stored JSON to an internal error instead of a user validation failure', () => {
    const f = fixture();
    expect(() =>
      f.validate.assert('PublicStep', { bad: undefined }, true),
    ).toThrow('nodia_ai:invalid_persisted_state');
  });
});
