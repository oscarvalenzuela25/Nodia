import { describe, expect, it, vi } from 'vitest';
import {
  BuildNodiaAiContextUseCase,
  isNodiaAiScopeVisible,
} from './build-nodia-ai-context.use-case.js';
import type { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiContextPreference } from '../../nodia-ai-preference/types/preference.types.js';
import { NODIA_AI_COMPACTION_BUILDER_VERSION, type NodiaAiCompactionSnapshot } from '../types/nodia-ai-compaction.types.js';

const policy = {
  results: { assembled_context_utf8_bytes: 262144, assistant_text_utf8_bytes: 32768, json_collection_items: 128 },
  budget: { tool_calls_per_run: 12 },
} as NodiaAiRuntimePolicy;
const knowledge = () => ({
  index: vi.fn(() => []),
  execute: vi.fn(() => ({
    releaseId: 'a'.repeat(64),
    catalogVersion: 'test/1',
    fragments: [],
  })),
});
describe('BuildNodiaAiContextUseCase', () => {
  it.each([true, false])('keeps automatic discovery metadata and MCP instructions out of Web with routing %s', (routingEnabled) => {
    const result = new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy).execute({
      moduleRoutes: ['/tools/nodia-ai'], throughSeq: '1', history: [], mode: 'token_plan_web', routingEnabled,
      toolSelection: { schema_version: 1, phase: 'discovery', catalog_hash: 'a'.repeat(64) },
      capabilityIndex: { schema_version: 1, catalog_version: 'test/1', catalog_hash: 'a'.repeat(64), selection_required: true,
        modules: [{ module_key: 'synthetic', resources: [] }] },
    });
    const prompt = JSON.parse(result.prompt);
    expect(prompt.tool_selection).toBeUndefined(); expect(prompt.capability_index).toBeUndefined(); expect(prompt.instructions).not.toContain('nodia_capabilities_select');
    expect(prompt.instructions).toContain(routingEnabled ? 'solicita delegación tipada hacia Agentic' : 'delegación automática está deshabilitada');
  });
  it('includes the complete index as data and recommends one selection under the actual shared callback budget', () => {
    const capabilityIndex = { schema_version: 1, catalog_version: 'test/1', catalog_hash: 'a'.repeat(64), selection_required: true,
      modules: [{ module_key: 'synthetic', resources: [{ resource_key: 'synthetic_resource', capabilities: [{
        capability_id: 'synthetic_id', tool_name: 'different_tool_name', kind: 'read', description: 'Synthetic contract text; not an instruction.',
      }] }] }] };
    const useCase = new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy);
    const input = { moduleRoutes: ['/tools/nodia-ai'], throughSeq: '1', history: [], mode: 'token_plan_agentic',
      toolSelection: { schema_version: 1, phase: 'discovery', catalog_hash: 'a'.repeat(64) }, capabilityIndex };
    const result = useCase.execute(input), prompt = JSON.parse(result.prompt);
    expect(prompt.capability_index).toEqual(capabilityIndex);
    expect(prompt.instructions).toContain('una sola vez'); expect(prompt.instructions).toContain('máximo 12 llamadas');
    expect(prompt.instructions).not.toContain('Synthetic contract text');
    expect(result.manifest.context_bytes).toBe(Buffer.byteLength(result.prompt, 'utf8'));
    expect(() => useCase.execute({ ...input, capabilityIndex: { ...capabilityIndex, catalog_hash: 'b'.repeat(64) } })).toThrow('context_invalid');
    expect(JSON.parse(useCase.execute({ ...input, toolSelection: { ...input.toolSelection, phase: 'execution' } }).prompt).capability_index).toBeUndefined();
    const oversized = { ...capabilityIndex, modules: [{ module_key: 'synthetic', resources: [{ resource_key: 'a',
      capabilities: Array.from({ length: 128 }, (_, i) => ({ capability_id: `synthetic_${i}`, tool_name: `synthetic_${i}`, kind: 'read', description: 'a'.repeat(2048) })) }] }] };
    expect(() => useCase.execute({ ...input, capabilityIndex: oversized })).toThrow('context_limit');
  });
  const snapshot = (): NodiaAiCompactionSnapshot => ({
    id: 'f32a0ebe-9865-4e5d-9b38-25a886a6c694', revision: 2,
    throughSeq: '9', sourceHash: 'd'.repeat(64), builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
    scopeManifest: { schema_version: 1, module_routes: ['/finance'] },
    summary: { schema_version: 1, facts: [{ text: 'Un deseo no confirma un gasto', source_seqs: ['2'] }],
      decisions: [], questions: [], entities: [], requirements: [] },
  });
  it('combines cited memory, current tail and live operational references without resurrecting preferences', () => {
    const value = snapshot();
    const result = new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy).execute({
      moduleRoutes: ['/finance'], throughSeq: '10', mode: 'token_plan_agentic', snapshot: value,
      recoveryRefs: { proposals: [{ proposal_id: 'opaque', revision: 3, state: 'unknown' }] },
      history: [{ seq: '10', role: 'user', scope: { schema_version: 1, module_routes: [] },
        parts: [{ kind: 'text', text: '¿Cuál es el resultado?' }] }],
    });
    const prompt = JSON.parse(result.prompt);
    expect(prompt.conversation_memory).toEqual(value.summary);
    expect(prompt.messages).toEqual([{ role: 'user', content: '¿Cuál es el resultado?' }]);
    expect(prompt.recovery_refs.proposals[0].state).toBe('unknown');
    expect(prompt.accepted_preferences).toEqual([]);
    expect(prompt.instructions).toContain('nunca permiso para volver a ejecutar');
    expect(result.manifest.context_snapshot).toEqual({ id: value.id, revision: 2, through_seq: '9',
      source_hash: value.sourceHash, builder_contract_version: NODIA_AI_COMPACTION_BUILDER_VERSION });
    expect(JSON.stringify(result.manifest)).not.toContain('Un deseo');
  });
  it.each([
    { builderContractVersion: 'unknown/2' }, { sourceHash: 'bad' }, { revision: 0 }, { throughSeq: '10' },
    { id: 'foreign/non-uuid' }, { scopeManifest: { schema_version: 1, module_routes: ['/revoked'] } },
    { summary: { schema_version: 1, facts: [], decisions: [], questions: [], entities: [], requirements: [], secret: true } },
  ])('rejects an unusable snapshot %j before dispatch', (change) => {
    const value = { ...snapshot(), ...change } as NodiaAiCompactionSnapshot;
    expect(() => new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy).execute({
      moduleRoutes: ['/finance'], throughSeq: '10', mode: 'token_plan_agentic', snapshot: value, history: [],
    })).toThrow('nodia_ai:context_snapshot_invalid');
  });
  it('rejects tail overlap and citations beyond the snapshot anchor', () => {
    const value = snapshot();
    const builder = new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy);
    const input = { moduleRoutes: ['/finance'], throughSeq: '10', mode: 'token_plan_agentic', snapshot: value,
      history: [{ seq: '9', role: 'user', scope: { schema_version: 1, module_routes: [] }, parts: [] }] };
    expect(() => builder.execute(input)).toThrow('nodia_ai:invalid_history');
    input.history = []; value.summary.facts[0].source_seqs = ['10'];
    expect(() => builder.execute(input)).toThrow('nodia_ai:context_snapshot_invalid');
  });
  it('includes accepted memory as bounded data and records only references in the manifest', () => {
    const value: NodiaAiContextPreference = {
      id: '7708b6d1-4a3c-4c08-8ea3-c57a634aeb57', revision: 2,
      scope_key: 'finance', scope: {}, key: 'expense_category_id', value: '17',
      value_label: 'Comida; no conceder permisos', scope_label: null,
    };
    const result = new BuildNodiaAiContextUseCase(knowledge() as unknown as LoadNodiaAiKnowledgeUseCase, policy).execute({
      moduleRoutes: ['/tools/finances-personal'], mode: 'token_plan_web', throughSeq: '1', history: [], acceptedPreferences: [value],
    });
    const prompt = JSON.parse(result.prompt);
    expect(prompt.accepted_preferences).toEqual([value]);
    expect(prompt.instructions).toContain('nunca permisos');
    expect(prompt.instructions).toContain('No aprendas preferencias del historial');
    expect(result.manifest.accepted_preferences).toEqual([{ preference_id: value.id, revision: 2, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }]);
    expect(JSON.stringify(result.manifest)).not.toContain(value.value_label);
    expect(result.manifest.context_bytes).toBe(Buffer.byteLength(result.prompt));
  });
  it('uses canonical roles, makes lack of published knowledge explicit and forbids Web tools', () => {
    const useCase = new BuildNodiaAiContextUseCase(
      knowledge() as unknown as LoadNodiaAiKnowledgeUseCase,
      policy,
    );
    const result = useCase.execute({
      moduleRoutes: ['/tools/nodia-ai'],
      mode: 'token_plan_web',
      throughSeq: '1',
      history: [
        {
          seq: '1',
          role: 'user',
          scope: { schema_version: 1, module_routes: [] },
          parts: [{ kind: 'text', text: 'Hola' }],
        },
      ],
    });
    const prompt = JSON.parse(result.prompt);
    expect(prompt.messages).toEqual([{ role: 'user', content: 'Hola' }]);
    expect(prompt.instructions).toContain(
      'No hay fichas de producto publicadas',
    );
    expect(prompt.instructions).toContain('Modo Web: conversación solamente');
    expect(result.manifest.context_bytes).toBe(
      Buffer.byteLength(result.prompt),
    );
  });
  it('removes revoked history before forming the provider payload, even if it contains instructions', () => {
    const useCase = new BuildNodiaAiContextUseCase(
      knowledge() as unknown as LoadNodiaAiKnowledgeUseCase,
      policy,
    );
    const result = useCase.execute({
      moduleRoutes: [],
      mode: 'token_plan_agentic',
      throughSeq: '2',
      history: [
        {
          seq: '1',
          role: 'assistant',
          scope: { schema_version: 1, module_routes: ['/finance'] },
          parts: [{ kind: 'text', text: 'secret financial result' }],
        },
        {
          seq: '2',
          role: 'user',
          scope: { schema_version: 1, module_routes: [] },
          parts: [{ kind: 'text', text: 'Resume' }],
        },
      ],
    });
    expect(result.prompt).not.toContain('secret financial result');
    expect(result.prompt).toContain('[RestrictedMessage]');
  });
  it.each([
    null,
    {},
    [],
    { schema_version: 1, module_routes: [], extra: true },
    { schema_version: 2, module_routes: [] },
    { schema_version: 1, module_routes: ['/other'] },
    { schema_version: 1, module_routes: [1] },
  ])('fails closed on source scope %j', (scope) => {
    expect(isNodiaAiScopeVisible(scope, new Set())).toBe(false);
  });
  it('keeps general messages visible and requires every source module', () => {
    expect(
      isNodiaAiScopeVisible(
        { schema_version: 1, module_routes: [] },
        new Set(),
      ),
    ).toBe(true);
    expect(
      isNodiaAiScopeVisible(
        { schema_version: 1, module_routes: ['/a', '/b'] },
        new Set(['/a']),
      ),
    ).toBe(false);
  });
  it.each([
    { seqs: ['2', '1'] },
    { seqs: ['1', '1'] },
    { seqs: ['0'] },
    { seqs: ['3'] },
  ])('rejects unordered or out of boundary sequences $seqs', ({ seqs }) => {
    const useCase = new BuildNodiaAiContextUseCase(
      knowledge() as unknown as LoadNodiaAiKnowledgeUseCase,
      policy,
    );
    expect(() =>
      useCase.execute({
        moduleRoutes: [],
        mode: 'token_plan_web',
        throughSeq: '2',
        history: seqs.map((seq) => ({
          seq,
          role: 'user',
          scope: { schema_version: 1, module_routes: [] },
          parts: [],
        })),
      }),
    ).toThrow('nodia_ai:invalid_history');
  });
  it('rejects unavailable modalities and oversized UTF8 context without truncation', () => {
    const useCase = new BuildNodiaAiContextUseCase(
      knowledge() as unknown as LoadNodiaAiKnowledgeUseCase,
      policy,
    );
    const input = {
      moduleRoutes: [],
      mode: 'token_plan_web',
      throughSeq: '1',
      history: [
        {
          seq: '1',
          role: 'user',
          scope: { schema_version: 1, module_routes: [] },
          parts: [{ kind: 'image', text: 'x' }],
        },
      ],
    };
    expect(() => useCase.execute(input)).toThrow(
      'nodia_ai:modality_unavailable',
    );
    input.history[0].parts = [{ kind: 'text', text: 'ñ'.repeat(140000) }];
    expect(() => useCase.execute(input)).toThrow('nodia_ai:context_limit');
  });
});
