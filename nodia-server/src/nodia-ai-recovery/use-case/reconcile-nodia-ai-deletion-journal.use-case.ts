import { Injectable } from '@nestjs/common';
import type { NodiaAiJournalResource } from '../types/deletion-journal.js';
import { journalResource, type ExternalDeletionEntry } from './update-nodia-ai-external-state.use-case.js';

type ResourceKind = NodiaAiJournalResource['kind'];
export interface NodiaAiDeletionExistencePort {
  /** One bounded set read per kind. SQL/transaction ownership belongs to the operator. */
  findExisting(kind: ResourceKind, ids: readonly string[]): Promise<unknown>;
}
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const invalid = (): never => { throw Error('nodia_ai:recovery_reconciliation_invalid'); };
const idOf = (resource: NodiaAiJournalResource): string => resource.kind === 'preference'
  ? resource.preference_id : resource.kind === 'attachment' ? resource.attachment_id : resource.conversation_id;

/** Reconciles every bounded pending witness. A present early record never starves
 * later committed removals; this rule performs no SQL writes or external ACK. */
@Injectable()
export class ReconcileNodiaAiDeletionJournalUseCase {
  async execute(entries: readonly ExternalDeletionEntry[], port: NodiaAiDeletionExistencePort) {
    if (!Array.isArray(entries) || entries.length > 10_000) return invalid();
    const resources = entries.map(entry => {
      if (!entry || typeof entry !== 'object' || entry.confirmed_at !== null) return invalid();
      // Reuse the production journal's closed resource/UUID validation rather
      // than accepting a caller-controlled table name or copying its schema.
      return journalResource(entry);
    });
    const existing = new Map<ResourceKind, Set<string>>();
    for (const kind of ['conversation', 'attachment', 'preference'] as const) {
      const ids = [...new Set(resources.filter(resource => resource.kind === kind).map(idOf))];
      if (!ids.length) continue;
      const requested = new Set(ids);
      const found = await port.findExisting(kind, ids);
      if (!Array.isArray(found) || found.length > ids.length ||
        found.some(id => typeof id !== 'string' || !uuid.test(id) || !requested.has(id)) ||
        new Set(found).size !== found.length) return invalid();
      existing.set(kind, new Set(found as string[]));
    }
    const confirmed = resources.filter(resource => !existing.get(resource.kind)!.has(idOf(resource)));
    return { confirmed, pending: resources.length - confirmed.length };
  }
}
