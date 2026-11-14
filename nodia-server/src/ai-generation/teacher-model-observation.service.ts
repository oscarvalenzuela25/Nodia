import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { currentActor, lockAuthority, type ActorReference } from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { CodexRuntimeService } from '../common/ai/codex/codex-runtime.service.js';
import { CodexOperationException } from '../common/ai/codex/codex-contract.js';
import { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import type { TeacherConnectionModels } from '../teacher/types/teacher.types.js';
import { teacherError } from '../teacher/policies/teacher-validation.js';
import { agenticHash } from './agentic-text-contract.js';

/** 200 configured catalog entries plus one explicitly selected historical ID. */
export const TEACHER_OBSERVED_MODELS_MAX = 201;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Buffer.byteLength(value, 'utf8') <= 1024;
}

/** Live non-generative metadata for an already configured Teacher connection. */
@Injectable()
export class TeacherModelObservationService {
  constructor(
    private readonly source: DataSource,
    private readonly access: CheckModuleAccessUseCase,
    private readonly connections: NodiaAiConnectionsService,
    private readonly codex: CodexRuntimeService,
  ) {}

  private async configuration(actor: ActorReference, id: string, mode: string) {
    return this.source.transaction(async manager => {
      await lockAuthority(manager);
      const identity = await currentActor(manager, actor);
      await this.access.execute(identity.actorId, ['/nodia-teacher'], manager);
      const connection = await this.connections.find(manager, id);
      if (!connection || connection.is_active !== true || connection.catalog_active !== true || connection.use_agentic !== true || connection.can_use_agentic !== true)
        teacherError('provider_unavailable', 503);
      if (mode !== 'agentic' || connection.provider_key !== 'openai') teacherError('model_observation_unsupported', 400);
      const fields = record(connection.fields);
      const scoped = record(fields.agentic);
      const saved: unknown = scoped.available_models;
      if (saved !== undefined && (!Array.isArray(saved) || saved.length > 200)) teacherError('connection_catalog_too_large', 503);
      const ids = new Set<string>((Array.isArray(saved) ? saved : []).flatMap(item => {
        const model = record(item);
        return identifier(model.id) ? [model.id] : [];
      }));
      if (identifier(scoped.selected_model)) ids.add(scoped.selected_model);
      return { ids, generation: agenticHash({ connection, mode }) };
    });
  }

  async execute(actor: ActorReference, id: string, mode: string, callerSignal?: AbortSignal): Promise<TeacherConnectionModels> {
    if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) teacherError('invalid_input', 400);
    callerSignal?.throwIfAborted();
    const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
    const checkCancellation = () => {
      callerSignal?.throwIfAborted();
      if (signal.aborted) throw new ServiceUnavailableException('teacher:model_observation_timeout');
    };
    const before = await this.configuration(actor, id, mode);
    checkCancellation();
    let observed: unknown;
    try {
      // Never keep authority/configuration locks open during native profile I/O.
      observed = await this.codex.listModels(id, signal);
      checkCancellation();
    } catch (error) {
      callerSignal?.throwIfAborted();
      if (error instanceof CodexOperationException && error.code === 'codex_protocol_invalid')
        throw new BadGatewayException('teacher:model_observation_invalid');
      throw new ServiceUnavailableException(signal.aborted ? 'teacher:model_observation_timeout' : 'teacher:provider_unavailable');
    }
    const after = await this.configuration(actor, id, mode);
    checkCancellation();
    if (before.generation !== after.generation) teacherError('configuration_changed');
    if (!Array.isArray(observed) || observed.length > 1000) throw new BadGatewayException('teacher:model_observation_invalid');
    const seen = new Set<string>();
    const models: TeacherConnectionModels['models'] = [];
    for (const item of observed) {
      const model = record(item);
      const efforts = model.supportedReasoningEfforts;
      if (!identifier(model.id) || seen.has(model.id) || !Array.isArray(efforts) || efforts.length > 32
        || !Array.from(efforts).every((effort: unknown): effort is string => typeof effort === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(effort)))
        throw new BadGatewayException('teacher:model_observation_invalid');
      seen.add(model.id);
      if (!after.ids.has(model.id)) continue;
      const label = model.displayName ?? model.name ?? model.id;
      if (!identifier(label)) throw new BadGatewayException('teacher:model_observation_invalid');
      models.push({ model_id: model.id, label, efforts: [...new Set<string>(efforts)].map(effort_id => ({ effort_id, label: effort_id })) });
    }
    if (models.length > TEACHER_OBSERVED_MODELS_MAX) throw new BadGatewayException('teacher:model_observation_invalid');
    return { connection_id: id, mode: 'agentic', models };
  }
}
