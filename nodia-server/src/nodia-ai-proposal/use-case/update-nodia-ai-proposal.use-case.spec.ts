import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import {
  NodiaAiProposalFieldEditDto,
  UpdateNodiaAiProposalDto,
} from '../dto/nodia-ai-proposal.dto.js';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { UpdateNodiaAiProposalUseCase } from './update-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';
import { proposalFixture } from './proposal.fixture.js';
import { randomUUID } from 'node:crypto';
import {
  NODIA_AI_WORKFLOW_CATALOG_VERSION,
  type NodiaAiProposalBindingSource,
} from '../types/workflow.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
function fixture() {
  const f = proposalFixture();
  const loaded = {
    proposal: f.proposal,
    revision: f.revision,
    steps: [f.step],
    now: f.now,
    chat: f.chat,
    context: {
      manager: f.manager,
      actor: f.actor,
      conversationId: f.chat.id,
      moduleRoutes: ['/finance'],
    },
  };
  const get = { load: vi.fn(async () => loaded) };
  const prepare = { step: PrepareNodiaAiProposalUseCase.prototype.step };
  const update = new UpdateNodiaAiProposalUseCase(
    f.store as unknown as NodiaAiProposalService,
    get as unknown as GetNodiaAiProposalUseCase,
    f.validate,
    prepare as PrepareNodiaAiProposalUseCase,
    f.policy,
  );
  const command = {
    expected_proposal_revision: 1,
    expected_hash: f.revision.hash,
    edits: [{ step_id: f.step.id, field_key: 'name', value: 'Corrected' }],
  };
  vi.mocked(f.preparer.applyEdits).mockResolvedValue({ name: 'Corrected' });
  vi.mocked(f.preparer.prepare).mockResolvedValue({
    status: 'ready',
    commandTemplate: { name: 'Corrected' },
    scope: f.step.scope,
    preconditions: { version: '2' },
    publicStep: {
      ...f.step.public_step,
      changes: [
        {
          field_key: 'name',
          before: null,
          after: 'Corrected',
          before_present: false,
          after_present: true,
          origin: 'user',
        },
      ],
    },
  });
  return { ...f, loaded, get, update, command };
}
describe('Correct a NodiaAI proposal with a new frozen revision', () => {
  it('rebuilds dependent symbolic previews against the edited predecessor and remaps every immutable step reference', async () => {
    const f = fixture();
    Object.assign(f.preparer, {
      bindableFields: { parent_id: 'record_id' },
      outputKeys: { id: 'record_id' },
    });
    const dependent = structuredClone(f.step);
    dependent.id = randomUUID();
    dependent.position = 2;
    dependent.command_template = { name: 'Child', parent_ref: f.step.id };
    dependent.public_step = {
      ...dependent.public_step,
      step_id: dependent.id,
      depends_on: [f.step.id],
      output_bindings: [
        {
          target_field_key: 'parent_id',
          from_step_id: f.step.id,
          output_key: 'id',
        },
      ],
      changes: [
        {
          field_key: 'parent_id',
          before: null,
          after: null,
          before_present: false,
          after_present: false,
          origin: 'future_step',
        },
      ],
    };
    dependent.output_bindings = dependent.public_step
      .output_bindings as NodiaAiJsonObject[];
    f.loaded.steps.push(dependent);
    f.revision.catalog_version = NODIA_AI_WORKFLOW_CATALOG_VERSION;
    f.revision.hash = String(
      f.validate.compile(f.proposal, f.revision, f.loaded.steps, false).hash,
    );
    f.command.expected_hash = f.revision.hash;
    const reprepareWithBindings = vi.fn(
      async (
        template: NodiaAiJsonObject,
        bindings: readonly NodiaAiProposalBindingSource[],
      ) => ({
        status: 'ready' as const,
        commandTemplate: { ...template, parent_ref: bindings[0].from_step_id },
        scope: dependent.scope,
        preconditions: { parent_name: bindings[0].source.commandTemplate.name },
        publicStep: dependent.public_step,
      }),
    );
    Object.assign(f.preparer, { reprepareWithBindings });
    const before = JSON.stringify(dependent);
    await f.update.execute(f.identity, f.proposal.id, f.command);
    const saved = f.store.advance.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      typeof f.loaded.steps,
    ];
    const [first, second] = saved[3];
    expect(reprepareWithBindings).toHaveBeenCalledOnce();
    expect(second.command_template.parent_ref).toBe(first.id);
    expect(second.preconditions.parent_name).toBe('Corrected');
    expect(second.public_step.depends_on).toEqual([first.id]);
    expect(second.output_bindings[0].from_step_id).toBe(first.id);
    expect(first.id).not.toBe(f.step.id);
    expect(second.id).not.toBe(dependent.id);
    expect(JSON.stringify(dependent)).toBe(before);
  });
  it('reprepares a backend template through its dedicated port rather than the model entry point', async () => {
    const f = fixture();
    const originalPrepare = f.preparer.prepare;
    const reprepareStored = vi.fn(originalPrepare);
    const rawPrepare = vi.fn(async () => {
      throw new Error('Model entry point cannot accept backend templates');
    });
    Object.assign(f.preparer, { reprepareStored, prepare: rawPrepare });
    await f.update.execute(f.identity, f.proposal.id, f.command);
    expect(reprepareStored).toHaveBeenCalledOnce();
    expect(rawPrepare).not.toHaveBeenCalled();
  });
  it('adapts actual ValidationPipe DTO and nested edit instances before strict JCS validation', async () => {
    const f = fixture();
    const dto = plainToInstance(UpdateNodiaAiProposalDto, f.command);
    expect(dto).toBeInstanceOf(UpdateNodiaAiProposalDto);
    expect(dto.edits[0]).toBeInstanceOf(NodiaAiProposalFieldEditDto);
    expect(
      (await f.update.execute(f.identity, f.proposal.id, dto)).revision,
    ).toBe(2);
  });
  it.each([
    'extra',
    'getter',
    'symbol',
    'nested_extra',
    'nested_getter',
    'array_getter',
    'arbitrary_class',
    'toJSON',
  ])(
    'rejects DTO %s without dropping keys or evaluating behavior',
    async (kind) => {
      const f = fixture();
      const dto = plainToInstance(UpdateNodiaAiProposalDto, f.command);
      const behavior = vi.fn(() => 'untrusted');
      if (kind === 'extra')
        Object.defineProperty(dto, 'owner_id', {
          value: '2',
          enumerable: true,
        });
      if (kind === 'getter')
        Object.defineProperty(dto, 'expected_hash', {
          get: behavior,
          enumerable: true,
        });
      if (kind === 'symbol')
        Object.defineProperty(dto, Symbol('hidden'), { value: 'secret' });
      if (kind === 'nested_extra')
        Object.defineProperty(dto.edits[0], 'sql', {
          value: 'bad',
          enumerable: true,
        });
      if (kind === 'nested_getter')
        Object.defineProperty(dto.edits[0], 'value', {
          get: behavior,
          enumerable: true,
        });
      if (kind === 'array_getter')
        Object.defineProperty(dto.edits, '0', {
          get: behavior,
          enumerable: true,
        });
      if (kind === 'arbitrary_class')
        dto.edits[0].value = Object.assign(new (class Untrusted {})(), {
          any: 'value',
        });
      if (kind === 'toJSON')
        Object.defineProperty(dto, 'toJSON', {
          value: behavior,
          enumerable: true,
        });
      await expect(
        f.update.execute(f.identity, f.proposal.id, dto),
      ).rejects.toThrow();
      expect(behavior).not.toHaveBeenCalled();
      expect(f.store.advance).not.toHaveBeenCalled();
    },
  );
  it('keeps the previous revision intact, rotates step identity/hash, and never extends expiry', async () => {
    const f = fixture();
    const before = JSON.stringify(f.step);
    const priorHash = f.revision.hash;
    const result = await f.update.execute(f.identity, f.proposal.id, f.command);
    expect(result.revision).toBe(2);
    expect(result.hash).not.toBe(priorHash);
    const stored = f.store.advance.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { expires_at: Date },
      { id: string }[],
    ];
    expect(stored[2].expires_at).toEqual(f.revision.expires_at);
    expect(stored[3][0].id).not.toBe(f.step.id);
    expect(JSON.stringify(f.step)).toBe(before);
  });
  it.each(['revision', 'hash', 'state', 'expired', 'busy'])(
    'rejects %s conflicts before preparing any correction',
    async (kind) => {
      const f = fixture();
      if (kind === 'revision') f.command.expected_proposal_revision = 2;
      if (kind === 'hash') f.command.expected_hash = 'b'.repeat(64);
      if (kind === 'state') f.revision.state = 'confirmed';
      if (kind === 'expired') f.loaded.now = new Date(f.revision.expires_at);
      if (kind === 'busy') f.loaded.chat.active_job_id = 'busy' as never;
      await expect(
        f.update.execute(f.identity, f.proposal.id, f.command),
      ).rejects.toThrow();
      expect(f.preparer.prepare).not.toHaveBeenCalled();
      expect(f.store.advance).not.toHaveBeenCalled();
    },
  );
  it.each(['field', 'step', 'duplicate', 'scope', 'clarification'])(
    'rejects %s edits and preserves the old proposal',
    async (kind) => {
      const f = fixture();
      if (kind === 'field') f.command.edits[0].field_key = 'owner_id';
      if (kind === 'step') f.command.edits[0].step_id = f.proposal.id;
      if (kind === 'duplicate') f.command.edits.push({ ...f.command.edits[0] });
      if (kind === 'scope')
        vi.mocked(f.preparer.prepare).mockResolvedValueOnce({
          status: 'ready',
          commandTemplate: {},
          scope: { subject_user_id: '2' },
          preconditions: {},
          publicStep: f.step.public_step,
        });
      if (kind === 'clarification')
        vi.mocked(f.preparer.prepare).mockResolvedValueOnce({
          status: 'needs_clarification',
          partial: {},
          missingFields: ['name'],
          clarificationKeys: [],
        });
      await expect(
        f.update.execute(f.identity, f.proposal.id, f.command),
      ).rejects.toThrow();
      expect(f.store.advance).not.toHaveBeenCalled();
      expect(f.revision.revision).toBe(1);
    },
  );
});
