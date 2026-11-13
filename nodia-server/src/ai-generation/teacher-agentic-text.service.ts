import { Inject, Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource, type EntityManager } from 'typeorm';
import { AiGenerationPort, type AiGenerationExecutionContext, type AiGenerationResult } from './ai-generation-port.js';
import type { AiSelection } from './ai-selection.js';
import { TEACHER_GENERATION_POLICY_HASH, TEACHER_GENERATION_POLICY } from './teacher-qualification-policy.js';
import { GeminiTeacherTextTransport } from './gemini-teacher-text-transport.js';
import {
  CODEX_TEACHER_TEXT_TRANSPORT, TEACHER_AGENTIC_CONTRACT,
  TeacherAgenticClosedError, TeacherAgenticUnclosedError,
  agenticHash, agenticHex, agenticRecord, agenticUuid, agenticWellFormedText,
  parseTeacherAgenticObservation, parseTeacherAgenticProof, parseTeacherAgenticSnapshot,
  teacherAgenticReference,
  type TeacherAgenticCommand, type TeacherAgenticConfiguration, type TeacherAgenticDescriptor,
  type TeacherAgenticObservation, type TeacherAgenticProof, type TeacherAgenticProvider,
  type TeacherAgenticTransport,
} from './agentic-text-contract.js';

const referenceKeys = ['contract', 'operation_id', 'session_id', 'job_id', 'attempt_id', 'actor_id',
  'connection_id', 'model_id', 'effort_id', 'resource_key', 'configuration_generation',
  'session_generation', 'runtime_hash', 'policy_hash', 'request_hash'];
const exactText = (v: unknown, max: number): v is string => typeof v === 'string' && v === v.trim()
  && v.length > 0 && Buffer.byteLength(v, 'utf8') <= max && agenticWellFormedText(v) && ![...v].some(c => c.charCodeAt(0) < 32);
const decimal = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]{0,18}$/u.test(v) && BigInt(v) <= 9223372036854775807n;
function selectionValid(selection: AiSelection): void {
  if (!selection || selection.mode !== 'agentic' || !decimal(selection.connection_id)
      || !exactText(selection.model_id, 1024) || !(selection.effort_id === null || exactText(selection.effort_id, 256)))
    throw Error('teacher:agentic_selection_invalid');
}
function identity(observation: TeacherAgenticObservation) {
  const { observed_at: _at, ...stable } = observation;
  return stable;
}
export function teacherAgenticScope(selection: AiSelection, config: TeacherAgenticConfiguration): string {
  return agenticHash({ contract: TEACHER_AGENTIC_CONTRACT, policy_hash: TEACHER_GENERATION_POLICY_HASH, selection,
    configuration: config.configurationGeneration, observation: identity(config.agentic) });
}
export function validateTeacherAgenticDescriptor(descriptor: unknown): TeacherAgenticDescriptor {
  const value = agenticRecord(descriptor), reference = agenticRecord(value.reference);
  if (Object.keys(value).sort().join(',') !== 'provider,reference' || !['openai', 'gemini'].includes(String(value.provider))
      || Object.keys(reference).sort().join(',') !== [...referenceKeys].sort().join(',')
      || reference.contract !== TEACHER_AGENTIC_CONTRACT
      || !['operation_id', 'session_id', 'job_id', 'attempt_id'].every(k => agenticUuid(reference[k]))
      || !decimal(reference.actor_id) || !decimal(reference.connection_id) || !exactText(reference.model_id, 1024)
      || !(reference.effort_id === null || exactText(reference.effort_id, 256))
      || !['configuration_generation', 'runtime_hash', 'policy_hash', 'request_hash'].every(k => agenticHex(reference[k]))
      || !agenticHex(reference.session_generation, 32)
      || typeof reference.resource_key !== 'string'
      || !new RegExp(`^${value.provider === 'openai' ? 'codex' : 'gemini'}-profile:[0-9a-f]{64}$`).test(reference.resource_key))
    throw Error('teacher:agentic_protocol_invalid');
  return descriptor as TeacherAgenticDescriptor;
}

/** Exact Teacher text lane. SQL configuration never observes a live native runtime. */
@Injectable()
export class TeacherAgenticTextService extends AiGenerationPort {
  constructor(private readonly source: DataSource, private readonly gemini: GeminiTeacherTextTransport,
    @Inject(CODEX_TEACHER_TEXT_TRANSPORT) private readonly codex: TeacherAgenticTransport) { super(); }

  measure(prompt: string) { return { utf8Bytes: Buffer.byteLength(prompt, 'utf8'), maximumUtf8Bytes: 131072 }; }
  private transport(provider: TeacherAgenticProvider): TeacherAgenticTransport { return provider === 'gemini' ? this.gemini : this.codex; }

  private async selected(selection: AiSelection, manager: EntityManager) {
    selectionValid(selection);
    const rows: unknown = await manager.query(`SELECT p.id::text,p.is_active,p.use_agentic,p.fields,p.updated_at,
      c.key AS provider_key,c.is_active AS catalog_active,c.can_use_agentic
      FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1${manager.queryRunner?.isTransactionActive ? ' FOR SHARE OF p,c' : ''}`,
    [selection.connection_id]);
    const row = Array.isArray(rows) && rows.length === 1 ? agenticRecord(rows[0]) : null;
    if (!row || row.id !== selection.connection_id || !['openai', 'gemini'].includes(String(row.provider_key))
        || row.is_active !== true || row.use_agentic !== true || row.catalog_active !== true || row.can_use_agentic !== true)
      throw Error('teacher:agentic_connection_unavailable');
    const fields = row.fields !== null && typeof row.fields === 'object' && !Array.isArray(row.fields)
      ? row.fields as Record<string, unknown> : null;
    // Same canonical generation as the existing Agentic chat adapter; no Teacher alias resource.
    const generation = agenticHash({ connection_id: row.id, provider_key: row.provider_key, mode: selection.mode,
      fields: fields?.agentic ?? null, updated_at: row.updated_at, enabled: true });
    return { provider: row.provider_key as TeacherAgenticProvider, generation };
  }

  private project(selection: AiSelection, provider: TeacherAgenticProvider, generation: string, value: unknown): TeacherAgenticConfiguration {
    const observed = parseTeacherAgenticObservation(value, provider);
    if (!observed.available || !observed.resource_key || !observed.binary_sha512)
      throw Error('teacher:agentic_runtime_unavailable');
    return { providerKey: provider, connectionId: selection.connection_id, keyId: null,
      configurationGeneration: generation, sessionGeneration: observed.session_generation,
      resourceKey: observed.resource_key, agentic: observed };
  }

  async configuration(selection: AiSelection, manager: EntityManager = this.source.manager,
    qualificationOverride?: TeacherAgenticObservation): Promise<TeacherAgenticConfiguration> {
    const { provider, generation } = await this.selected(selection, manager);
    if (qualificationOverride) return this.project(selection, provider, generation, qualificationOverride);
    const rows: unknown = await manager.query(`SELECT scope_hash,contract_version,provider_key,selection_snapshot,
      configuration_generation,observation_snapshot FROM ai_generation_agentic_qualifications
      WHERE selection_hash=$1 AND configuration_generation=$2 ORDER BY observed_at DESC,scope_hash LIMIT 1`,
    [agenticHash(selection), generation]);
    if (!Array.isArray(rows) || rows.length !== 1) throw Error('teacher:adapter_unqualified');
    const row = agenticRecord(rows[0]);
    const config = this.project(selection, provider, generation, row.observation_snapshot);
    if (row.contract_version !== TEACHER_AGENTIC_CONTRACT || row.provider_key !== provider
        || row.configuration_generation !== generation || agenticHash(row.selection_snapshot) !== agenticHash(selection)
        || row.scope_hash !== teacherAgenticScope(selection, config)) throw Error('teacher:adapter_unqualified');
    return config;
  }

  async observe(selection: AiSelection, signal: AbortSignal): Promise<TeacherAgenticConfiguration> {
    const before = await this.selected(selection, this.source.manager);
    signal.throwIfAborted();
    const observed = await this.transport(before.provider).observe(selection, before.generation, signal);
    const after = await this.selected(selection, this.source.manager);
    if (agenticHash(before) !== agenticHash(after)) throw Error('teacher:configuration_changed');
    return this.project(selection, after.provider, after.generation, observed);
  }

  async eligibility(selection: AiSelection, signal: AbortSignal) {
    try {
      const live = await this.observe(selection, signal);
      const qualified = await this.configuration(selection);
      const matches = teacherAgenticScope(selection, live) === teacherAgenticScope(selection, qualified);
      const dates: { observed_at: Date | string }[] = matches ? await this.source.manager.query(
        'SELECT observed_at FROM ai_generation_agentic_qualifications WHERE scope_hash=$1', [teacherAgenticScope(selection, live)]) : [];
      return { eligible: matches && dates.length === 1, reason_code: matches && dates.length === 1 ? null : 'adapter_unqualified',
        checked_at: matches && dates.length === 1 ? dates[0].observed_at : null, selection };
    } catch (error) {
      if (signal.aborted) throw error;
      return { eligible: false, reason_code: error instanceof Error && error.message === 'teacher:adapter_unqualified'
        ? 'adapter_unqualified' : 'provider_unavailable', checked_at: null, selection };
    }
  }

  async recordQualification(manager: EntityManager, selection: AiSelection, config: TeacherAgenticConfiguration,
    operationId: string, responseHash: string, evidenceHash: string): Promise<void> {
    if (!agenticUuid(operationId) || !agenticHex(responseHash) || !agenticHex(evidenceHash)) throw Error('teacher:qualification_failed');
    const current = await this.configuration(selection, manager, config.agentic);
    if (agenticHash(current) !== agenticHash(config)) throw Error('teacher:configuration_changed');
    const rows: { scope_hash: string }[] = await manager.query(`INSERT INTO ai_generation_agentic_qualifications
      (scope_hash,contract_version,operation_id,provider_key,selection_hash,selection_snapshot,configuration_generation,observation_snapshot,response_hash,evidence_hash)
      SELECT $1::char(64),$2::text,o.id,$3::text,$4::char(64),$5::jsonb,$6::char(64),$7::jsonb,$8::char(64),$9::char(64) FROM ai_generation_operations o
      JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
      WHERE o.id=$10 AND o.owner_kind='teacher' AND o.phase='closed' AND o.remote_outcome='completed'
      AND o.response_hash=$8::text AND o.selection_snapshot=$5::jsonb AND o.configuration_generation=$6::text
      AND o.session_generation=$11 AND o.resource_key=$12 AND o.agentic_acknowledged_at IS NOT NULL
      AND o.agentic_transport_descriptor->'reference'->>'runtime_hash'=$13
      AND o.agentic_transport_descriptor->'reference'->>'policy_hash'=$14
      AND j.input_snapshot->'qualification_probe'->>'teacher_policy_hash'=$15
      AND j.template_hash=$16 AND j.purpose='setup_reply'
      ON CONFLICT(scope_hash) DO UPDATE SET operation_id=EXCLUDED.operation_id,response_hash=EXCLUDED.response_hash,
        evidence_hash=EXCLUDED.evidence_hash,observed_at=clock_timestamp() RETURNING scope_hash`,
    [teacherAgenticScope(selection, config), TEACHER_AGENTIC_CONTRACT, config.providerKey, agenticHash(selection),
      JSON.stringify(selection), config.configurationGeneration, JSON.stringify(config.agentic), responseHash, evidenceHash,
      operationId, config.sessionGeneration, config.resourceKey, config.agentic.runtime_hash, config.agentic.policy_hash,
      TEACHER_GENERATION_POLICY_HASH, TEACHER_GENERATION_POLICY.purposes.setup_reply.template_hash]);
    if (rows.length !== 1) throw Error('teacher:qualification_failed');
  }

  async execute(context: AiGenerationExecutionContext, signal: AbortSignal): Promise<AiGenerationResult> {
    let descriptor: TeacherAgenticDescriptor | null = null;
    let started = false;
    let terminal: TeacherAgenticProof | null = null;
    try {
      const size = this.measure(context.prompt);
      if (!context.prompt.trim() || size.utf8Bytes > size.maximumUtf8Bytes || !agenticWellFormedText(context.prompt)
          || !context.teacherOwner || !context.nativeObservation || !context.persistAgenticDescriptor)
        throw Error('teacher:agentic_context_invalid');
      signal.throwIfAborted();
      await context.checkLease();
      const config = await this.observe(context.selection, signal);
      if (context.configurationGeneration !== config.configurationGeneration || context.sessionGeneration !== config.sessionGeneration
          || context.resourceKey !== config.resourceKey || agenticHash(identity(context.nativeObservation)) !== agenticHash(identity(config.agentic)))
        throw Error('teacher:configuration_changed');
      const unsigned = { contract: TEACHER_AGENTIC_CONTRACT, operation_id: context.operationId,
        session_id: context.teacherOwner.sessionId, job_id: context.teacherOwner.jobId,
        attempt_id: context.teacherOwner.attemptId, actor_id: context.teacherOwner.actorId,
        connection_id: context.selection.connection_id, model_id: context.selection.model_id,
        effort_id: context.selection.effort_id, resource_key: config.resourceKey,
        configuration_generation: config.configurationGeneration, session_generation: config.sessionGeneration,
        runtime_hash: config.agentic.runtime_hash, policy_hash: config.agentic.policy_hash,
        prompt: context.prompt, deadline_at: context.deadlineAt.toISOString() };
      const command: TeacherAgenticCommand = { ...unsigned, request_hash: agenticHash(unsigned) };
      descriptor = validateTeacherAgenticDescriptor({ provider: config.providerKey, reference: teacherAgenticReference(command) });
      await context.persistAgenticDescriptor(structuredClone(descriptor));
      await context.checkLease();
      await context.beforeExchange();
      signal.throwIfAborted();
      await context.checkLease();
      const transport = this.transport(config.providerKey);
      const requestSignal = () => AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.min(30000, context.deadlineAt.getTime() - Date.now())))]);
      if (context.deadlineAt.getTime() <= Date.now()) throw Error('teacher:deadline_expired');
      signal.throwIfAborted();
      // No local failure or HTTP reader closure after this line proves native termination.
      started = true;
      const startSignal = config.providerKey === 'openai'
        ? AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, context.deadlineAt.getTime() - Date.now()))]) : requestSignal();
      let snapshot = parseTeacherAgenticSnapshot(await transport.start(command, startSignal), descriptor.reference);
      for (;;) {
        terminal = snapshot.terminal_proof;
        if (terminal) {
          if (snapshot.state !== 'completed' || terminal.remote_outcome !== 'completed' || snapshot.text === null || terminal.response_hash === null)
            throw new TeacherAgenticClosedError(descriptor, terminal, false);
          const responseHash = terminal.response_hash;
          signal.throwIfAborted();
          if (context.deadlineAt.getTime() <= Date.now()) throw Error('teacher:deadline_expired');
          await context.checkLease();
          return { text: snapshot.text, responseHash, localClosed: true,
            remoteOutcome: 'completed', agentic: { descriptor, proof: terminal } };
        }
        if (snapshot.state === 'unknown') throw new TeacherAgenticUnclosedError(descriptor);
        await context.checkLease();
        if (signal.aborted || context.deadlineAt.getTime() <= Date.now()) throw Error('teacher:deadline_expired');
        await delay(250, undefined, { signal: requestSignal() });
        snapshot = parseTeacherAgenticSnapshot(await transport.status(descriptor.reference, requestSignal()), descriptor.reference);
      }
    } catch (error) {
      if (!started) throw new TeacherAgenticClosedError(descriptor, null, true, 'agentic_preflight_failed');
      if (error instanceof TeacherAgenticClosedError && error.notStarted && descriptor && error.descriptor
          && agenticHash(error.descriptor) === agenticHash(descriptor)) throw error;
      if (descriptor && terminal) throw new TeacherAgenticClosedError(descriptor, terminal, false);
      const proof = descriptor ? await this.reconcile(descriptor, AbortSignal.timeout(5000)) : null;
      if (descriptor && proof) throw new TeacherAgenticClosedError(descriptor, proof, false);
      if (descriptor) throw new TeacherAgenticUnclosedError(descriptor);
      throw error;
    }
  }

  async reconcile(descriptor: TeacherAgenticDescriptor, signal: AbortSignal): Promise<TeacherAgenticProof | null> {
    validateTeacherAgenticDescriptor(descriptor);
    try {
      const snapshot = parseTeacherAgenticSnapshot(await this.transport(descriptor.provider).reconcile(descriptor.reference, signal), descriptor.reference);
      return snapshot.terminal_proof ? parseTeacherAgenticProof(snapshot.terminal_proof, descriptor.reference) : null;
    } catch { return null; }
  }

  async acknowledge(descriptor: TeacherAgenticDescriptor, proof: TeacherAgenticProof, signal: AbortSignal): Promise<void> {
    validateTeacherAgenticDescriptor(descriptor);
    const checked = parseTeacherAgenticProof(proof, descriptor.reference);
    await this.transport(descriptor.provider).acknowledge(descriptor.reference, checked, signal);
  }
}
