import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AnalysisContext, AnalysisIdentity, AnalysisProgress, AnalysisStage } from '../../common/ai/analysis-progress.js';

export type ObservationState = 'reserved' | 'running' | 'succeeded' | 'failed' | 'cancelled';
type Event = { version: 1; sequence: number; occurredAt: string; stage: AnalysisStage; severity: 'info' | 'warning' | 'error' };
type Observation = { id: string; actor: string; context: AnalysisContext; state: ObservationState;
  events: Event[]; sequence: number; expires: number; identity: AnalysisIdentity | null; gap: boolean };
const contextKeys = ['business_id', 'provider_id', 'ai_provider_id', 'ai_provider', 'model', 'model_type', 'mode', 'engine', 'thinking_level', 'extended_thinking'] as const;

/** Process-local bounded store. Shared TTL storage/affinity is required before multi-replica deployment. */
@Injectable()
export class AnalysisObservationsUseCase {
  private readonly observations = new Map<string, Observation>();
  private prune() {
    for (const [id, entry] of this.observations) if (entry.expires <= Date.now()) this.observations.delete(id);
  }
  reserve(actor: string, context: AnalysisContext) {
    this.prune();
    if (this.observations.size >= 1000 || [...this.observations.values()].filter(entry => entry.actor === actor).length >= 10) {
      throw new HttpException('Límite de observaciones alcanzado. Espere antes de iniciar otra.', 429);
    }
    const id = randomUUID();
    const entry: Observation = { id, actor, context: Object.fromEntries(contextKeys.map(key => [key, context[key]])) as AnalysisContext,
      state: 'reserved', events: [], sequence: 0, expires: Date.now() + 120_000, identity: null, gap: false };
    this.observations.set(id, entry);
    this.append(entry, 'reserved');
    return { version: 1 as const, id };
  }
  private owned(actor: string, id: string) {
    this.prune();
    const entry = this.observations.get(id);
    if (!entry || entry.actor !== actor) throw new NotFoundException('Observación no disponible.');
    return entry;
  }
  claim(actor: string, id: string): AnalysisProgress {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException('Identificador de observación inválido.');
    const entry = this.owned(actor, id);
    if (entry.state !== 'reserved') throw new ConflictException('La observación ya fue utilizada.');
    entry.state = 'running';
    // Longer than all supported principal deadlines; bounded even if transport fails to finalize.
    entry.expires = Date.now() + 420_000;
    this.append(entry, 'request_received');
    return {
      reportGap: () => { entry.gap = true; },
      validateContext: context => {
        if (contextKeys.some(key => (context[key] ?? undefined) !== (entry.context[key] ?? undefined))) {
          throw new ConflictException('La solicitud no corresponde al contexto reservado.');
        }
      },
      emit: stage => { if (entry.state === 'running') this.append(entry, stage); },
      resolve: identity => {
        if (entry.state !== 'running') return;
        // Explicit allowlist + bounded labels: no arbitrary upstream fields.
        entry.identity = { providerId: identity.providerId?.slice(0, 128) ?? null,
          provider: identity.provider.slice(0, 128), mode: identity.mode?.slice(0, 32) ?? null,
          model: identity.model?.slice(0, 128) ?? null };
        this.append(entry, 'connection_resolved');
      },
    };
  }
  private append(entry: Observation, stage: AnalysisStage) {
    // Collapse adjacent identical streaming categories; retain counters/sequence across eviction.
    if (entry.events.at(-1)?.stage === stage) return;
    entry.events.push({ version: 1, sequence: ++entry.sequence, occurredAt: new Date().toISOString(), stage,
      severity: stage === 'failed' ? 'error' : stage === 'observation_unavailable' || stage === 'cancelled' ? 'warning' : 'info' });
    if (entry.events.length > 256) entry.events.shift();
  }
  finish(actor: string, id: string, state: 'succeeded' | 'failed' | 'cancelled') {
    const entry = this.observations.get(id);
    if (!entry || entry.actor !== actor || entry.state !== 'running') return;
    this.append(entry, state === 'succeeded' ? 'extraction_validated' : state);
    entry.state = state;
    entry.expires = Date.now() + 300_000;
  }
  read(actor: string, id: string, after: number) {
    if (!Number.isSafeInteger(after) || after < 0) throw new BadRequestException('Cursor inválido.');
    const entry = this.owned(actor, id);
    if (after > entry.sequence) throw new BadRequestException('Cursor inválido.');
    const first = entry.events[0]?.sequence ?? 1;
    return { version: 1 as const, id, state: entry.state, identity: entry.identity,
      events: entry.events.filter(event => event.sequence > after), lastSequence: entry.sequence, gap: entry.gap || after < first - 1 };
  }
}
