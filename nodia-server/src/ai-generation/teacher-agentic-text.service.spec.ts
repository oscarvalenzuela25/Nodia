import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import type { AiGenerationExecutionContext } from './ai-generation-port.js';
import { TeacherAgenticTextService, teacherAgenticScope } from './teacher-agentic-text.service.js';
import type { GeminiTeacherTextTransport } from './gemini-teacher-text-transport.js';
import {
  TEACHER_AGENTIC_CONTRACT, TeacherAgenticClosedError, TeacherAgenticUnclosedError,
  agenticHash, agenticTextHash, teacherAgenticReference,
  type TeacherAgenticReference, type TeacherAgenticSnapshot, type TeacherAgenticObservation,
  type TeacherAgenticCommand,
} from './agentic-text-contract.js';

const selection = { connection_id: '4', mode: 'agentic' as const, model_id: 'synthetic-model', effort_id: 'synthetic-effort' };
const uuid = (v: string) => `${v.repeat(8)}-${v.repeat(4)}-4${v.repeat(3)}-8${v.repeat(3)}-${v.repeat(12)}`;
const signal = () => new AbortController().signal;
function observation(): TeacherAgenticObservation {
  return { contract: TEACHER_AGENTIC_CONTRACT, available: true, reason: null, observed_at: new Date().toISOString(),
    resource_key: 'gemini-profile:' + 'a'.repeat(64), session_generation: 'b'.repeat(32), runtime_hash: 'c'.repeat(64),
    binary_sha512: 'd'.repeat(128), policy_hash: 'e'.repeat(64), tool_policy: 'finish_only', native_io: false };
}
function snapshot(reference: TeacherAgenticReference, outcome: 'completed' | 'unknown' = 'completed', text: string | null = 'Synthetic answer'): TeacherAgenticSnapshot {
  return { contract: TEACHER_AGENTIC_CONTRACT, operation_id: reference.operation_id, state: outcome, text: outcome === 'completed' ? text : null,
    terminal_proof: { ...reference, terminal_proof_id: uuid('5'), process_closed: true, remote_outcome: outcome,
      response_hash: outcome === 'completed' ? agenticTextHash('Synthetic answer') : null, observed_at: new Date().toISOString() } };
}
async function fixture() {
  const observed = observation();
  let provider: Record<string, unknown> = { id: '4', provider_key: 'gemini', is_active: true, catalog_active: true,
    use_agentic: true, can_use_agentic: true, fields: { agentic: { selected_model: 'synthetic-model' } }, updated_at: new Date('2026-11-01T12:00:00Z') };
  let qualifications: unknown[] = [];
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    if (sql.includes('FROM ai_providers')) return [provider];
    if (sql.startsWith('SELECT observed_at')) return [{ observed_at: new Date('2026-11-01T12:01:00Z') }];
    if (sql.includes('FROM ai_generation_agentic_qualifications')) return qualifications;
    if (sql.startsWith('INSERT INTO ai_generation_agentic_qualifications')) return [{ scope_hash: parameters?.[0] }];
    throw Error('unexpected SQL in isolated fixture');
  });
  const manager = { query } as unknown as EntityManager;
  const native = {
    observe: vi.fn(async () => observed),
    start: vi.fn(async (command: TeacherAgenticCommand) => snapshot(teacherAgenticReference(command))),
    status: vi.fn(async (reference: TeacherAgenticReference) => snapshot(reference)),
    reconcile: vi.fn(async (reference: TeacherAgenticReference): Promise<TeacherAgenticSnapshot> => ({
      contract: TEACHER_AGENTIC_CONTRACT, operation_id: reference.operation_id, state: 'unknown', text: null, terminal_proof: null })),
    acknowledge: vi.fn(async () => {}),
  };
  const codex = { observe: vi.fn(async () => observed),
    start: vi.fn(async (command: TeacherAgenticCommand) => snapshot(teacherAgenticReference(command))),
    status: vi.fn(async (reference: TeacherAgenticReference) => snapshot(reference)),
    reconcile: vi.fn(async (reference: TeacherAgenticReference) => snapshot(reference, 'unknown')),
    acknowledge: vi.fn(async () => {}) };
  const service = new TeacherAgenticTextService({ manager } as DataSource, native as unknown as GeminiTeacherTextTransport, codex);
  const config = await service.configuration(selection, manager, observed);
  qualifications = [{ scope_hash: teacherAgenticScope(selection, config), contract_version: TEACHER_AGENTIC_CONTRACT,
    provider_key: 'gemini', selection_snapshot: selection, configuration_generation: config.configurationGeneration, observation_snapshot: structuredClone(observed) }];
  const order: string[] = [];
  const context: AiGenerationExecutionContext = { selection, operationId: uuid('1'), prompt: 'Synthetic untrusted educational input',
    resourceKey: config.resourceKey, configurationGeneration: config.configurationGeneration, sessionGeneration: config.sessionGeneration,
    nativeObservation: observed, deadlineAt: new Date(Date.now() + 60000), teacherOwner: { actorId: '1', sessionId: uuid('2'), jobId: uuid('3'), attemptId: uuid('4') },
    checkLease: vi.fn(async () => { order.push('lease'); }), beforeExchange: vi.fn(async () => { order.push('budget'); }),
    persistAgenticDescriptor: vi.fn(async () => { order.push('descriptor'); }) };
  return { service, native, codex, manager, query, observed, config, context, order,
    setProvider: (value: Record<string, unknown>) => { provider = value; }, getProvider: () => provider,
    setQualifications: (value: unknown[]) => { qualifications = value; } };
}

describe('Teacher Agentic identity, qualification and native closure', () => {
  it('rejects a legacy transport-only scope and accepts only the current application-policy scope', async () => {
    const f = await fixture();
    const { observed_at: _ignored, ...observationIdentity } = f.observed;
    const legacyScope = agenticHash({
      contract: TEACHER_AGENTIC_CONTRACT,
      selection,
      configuration: f.config.configurationGeneration,
      observation: observationIdentity,
    });
    const qualified = {
      contract_version: TEACHER_AGENTIC_CONTRACT,
      provider_key: 'gemini',
      selection_snapshot: selection,
      configuration_generation: f.config.configurationGeneration,
      observation_snapshot: structuredClone(f.observed),
    };
    f.setQualifications([{ ...qualified, scope_hash: legacyScope }]);
    await expect(f.service.configuration(selection)).rejects.toThrow(
      'adapter_unqualified',
    );
    f.setQualifications([
      { ...qualified, scope_hash: teacherAgenticScope(selection, f.config) },
    ]);
    expect(
      (await f.service.configuration(selection)).configurationGeneration,
    ).toBe(f.config.configurationGeneration);
    expect(f.native.observe).not.toHaveBeenCalled();
  });
  it('configuration is pure SQL under the caller manager and shares the exact chat generation rule', async () => {
    const f = await fixture();
    const transaction = { query: f.query, queryRunner: { isTransactionActive: true } } as unknown as EntityManager;
    expect(await f.service.configuration(selection, transaction)).toEqual(f.config);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('FOR SHARE OF p,c'))).toBe(true);
    expect(f.config.configurationGeneration).toBe(agenticHash({ connection_id: '4', provider_key: 'gemini', mode: 'agentic',
      fields: { selected_model: 'synthetic-model' }, updated_at: new Date('2026-11-01T12:00:00Z'), enabled: true }));
    expect(f.native.observe).not.toHaveBeenCalled();
    expect(f.codex.observe).not.toHaveBeenCalled();
    expect(f.config.keyId).toBeNull();
  });

  it('invalidates qualifications on selection, configuration, policy, binary and native epoch changes', async () => {
    const f = await fixture();
    expect((await f.service.eligibility(selection, signal())).eligible).toBe(true);
    const original = structuredClone(f.observed);
    for (const change of [{ session_generation: 'f'.repeat(32) }, { runtime_hash: 'f'.repeat(64) },
      { policy_hash: 'f'.repeat(64) }, { binary_sha512: 'f'.repeat(128) }]) {
      Object.assign(f.observed, original, change);
      expect((await f.service.eligibility(selection, signal())).eligible).toBe(false);
    }
    Object.assign(f.observed, original);
    expect((await f.service.eligibility({ ...selection, model_id: 'other-synthetic-model' }, signal())).eligible).toBe(false);
    f.setProvider({ ...f.getProvider(), updated_at: new Date('2026-11-01T12:02:00Z') });
    await expect(f.service.configuration(selection)).rejects.toThrow('adapter_unqualified');
    f.setQualifications([]);
    await expect(f.service.configuration(selection)).rejects.toThrow('adapter_unqualified');
  });

  it('malformed persisted observations fail closed without live I/O under the SQL configuration path', async () => {
    const f = await fixture();
    f.setQualifications([{ scope_hash: teacherAgenticScope(selection, f.config), contract_version: TEACHER_AGENTIC_CONTRACT,
      provider_key: 'gemini', selection_snapshot: selection, configuration_generation: f.config.configurationGeneration,
      observation_snapshot: { ...f.observed, native_io: true } }]);
    await expect(f.service.configuration(selection)).rejects.toThrow('protocol_invalid');
    expect(f.native.observe).not.toHaveBeenCalled();
  });

  it('rejects a provider change during live observation and never falls back', async () => {
    const f = await fixture();
    f.native.observe.mockImplementationOnce(async () => { f.setProvider({ ...f.getProvider(), is_active: false }); return f.observed; });
    await expect(f.service.observe(selection, signal())).rejects.toThrow();
    expect(f.codex.observe).not.toHaveBeenCalled();
    expect(f.native.start).not.toHaveBeenCalled();
  });

  it('persists the real owner descriptor and reserves budget before one native start', async () => {
    const f = await fixture();
    f.native.start.mockImplementationOnce(async command => { f.order.push('start'); return snapshot(teacherAgenticReference(command)); });
    const result = await f.service.execute(f.context, signal());
    expect(f.order.indexOf('descriptor')).toBeLessThan(f.order.indexOf('budget'));
    expect(f.order.indexOf('budget')).toBeLessThan(f.order.indexOf('start'));
    expect(f.native.start).toHaveBeenCalledOnce();
    const command = f.native.start.mock.calls[0][0];
    const { request_hash, ...unsigned } = command;
    expect(request_hash).toBe(agenticHash(unsigned));
    expect(command.session_id).toBe(f.context.teacherOwner?.sessionId);
    expect(command.job_id).toBe(f.context.teacherOwner?.jobId);
    expect(command.attempt_id).toBe(f.context.teacherOwner?.attemptId);
    expect(result.agentic?.descriptor.reference.request_hash).toBe(request_hash);
    expect(result.localClosed).toBe(true);
    expect(result.text).toBe('Synthetic answer');
  });

  it('polls an admitted native operation without restarting it', async () => {
    const f = await fixture();
    f.native.start.mockImplementationOnce(async command => ({ contract: TEACHER_AGENTIC_CONTRACT,
      operation_id: command.operation_id, state: 'running', text: null, terminal_proof: null }));
    expect((await f.service.execute(f.context, signal())).remoteOutcome).toBe('completed');
    expect(f.native.start).toHaveBeenCalledOnce();
    expect(f.native.status).toHaveBeenCalledOnce();
  });

  it('a lost HTTP response or status404 cannot prove native closure or trigger replay', async () => {
    const f = await fixture();
    f.native.start.mockRejectedValueOnce(Error('synthetic transport EOF'));
    await expect(f.service.execute(f.context, signal())).rejects.toBeInstanceOf(TeacherAgenticUnclosedError);
    expect(f.native.start).toHaveBeenCalledOnce();
    expect(f.native.reconcile).toHaveBeenCalledOnce();
    expect(f.codex.start).not.toHaveBeenCalled();
  });

  it('lost output with a valid terminal proof is locally closed but never published', async () => {
    const f = await fixture();
    f.native.start.mockImplementationOnce(async command => snapshot(teacherAgenticReference(command), 'completed', null));
    const error = await f.service.execute(f.context, signal()).catch(e => e);
    expect(error).toBeInstanceOf(TeacherAgenticClosedError);
    expect(error.notStarted).toBe(false);
    expect(error.proof.process_closed).toBe(true);
    expect(f.native.start).toHaveBeenCalledOnce();
  });

  it('abort after a real terminal retains closure proof and suppresses publication', async () => {
    const f = await fixture(), controller = new AbortController();
    f.native.start.mockImplementationOnce(async command => {
      controller.abort();
      return snapshot(teacherAgenticReference(command));
    });
    const error = await f.service.execute(f.context, controller.signal).catch(e => e);
    expect(error).toBeInstanceOf(TeacherAgenticClosedError);
    expect(error.notStarted).toBe(false);
    expect(error.proof.process_closed).toBe(true);
    expect(f.native.start).toHaveBeenCalledOnce();
  });

  it('a rejected local reservation excludes dispatch before start and preserves the descriptor', async () => {
    const f = await fixture();
    f.context.beforeExchange = async () => { throw Error('synthetic budget rejection'); };
    const error = await f.service.execute(f.context, signal()).catch(e => e);
    expect(error).toBeInstanceOf(TeacherAgenticClosedError);
    expect(error.notStarted).toBe(true);
    expect(error.descriptor.reference.operation_id).toBe(f.context.operationId);
    expect(f.native.start).not.toHaveBeenCalled();
  });

  it('only an exact owner/input/epoch native proof can close or acknowledge an operation', async () => {
    const f = await fixture();
    const result = await f.service.execute(f.context, signal());
    const { descriptor, proof } = result.agentic!;
    await expect(f.service.acknowledge(descriptor, { ...proof, actor_id: '2' }, signal())).rejects.toThrow('protocol_invalid');
    expect(f.native.acknowledge).not.toHaveBeenCalled();
    f.native.reconcile.mockImplementationOnce(async reference => snapshot({ ...reference, runtime_hash: 'f'.repeat(64) }, 'unknown'));
    expect(await f.service.reconcile(descriptor, signal())).toBeNull();
    await f.service.acknowledge(descriptor, proof, signal());
    expect(f.native.acknowledge).toHaveBeenCalledOnce();
  });

  it('records only a closed, acknowledged exact Teacher operation qualification with no native I/O', async () => {
    const f = await fixture();
    await f.service.recordQualification(f.manager, selection, f.config, uuid('1'), '7'.repeat(64), '8'.repeat(64));
    const call = f.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO ai_generation_agentic_qualifications'))!;
    expect(call[0]).toContain("o.owner_kind='teacher'");
    expect(call[0]).toContain('o.agentic_acknowledged_at IS NOT NULL');
    expect(call[1]?.[0]).toBe(teacherAgenticScope(selection, f.config));
    expect(f.native.observe).not.toHaveBeenCalled();
  });
});
