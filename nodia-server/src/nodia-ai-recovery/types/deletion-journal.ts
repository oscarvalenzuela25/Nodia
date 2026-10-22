export const NODIA_AI_DELETION_JOURNAL = Symbol('NODIA_AI_DELETION_JOURNAL');
export const NODIA_AI_DELETION_PROOF = Symbol('NODIA_AI_DELETION_PROOF');

export type NodiaAiJournalResource =
  | { kind: 'conversation'; conversation_id: string; storage_generations: string[] }
  | { kind: 'attachment'; conversation_id: string; attachment_id: string; storage_generations: string[] }
  | { kind: 'preference'; preference_id: string };

export interface NodiaAiDeletionJournalPort {
  readonly enabled: boolean;
  recordDeletions(input: { deleted_at: string; entries: { conversation_id: string; storage_generations: string[] }[] }): Promise<void>;
  recordResources(input: { deleted_at: string; resources: NodiaAiJournalResource[] }): Promise<void>;
  /** Must read the external authoritative state; no local cache or fabricated ACK. */
  assertResourcesRecorded(resources: NodiaAiJournalResource[]): Promise<void>;
  /** Confirms only a committed SQL removal; lost ACK remains a minimal pending witness. */
  confirmResources(resources: NodiaAiJournalResource[]): Promise<void>;
}

/** Explicit compatibility/offline composition. Does not protect or authorize backups. */
export class DisabledNodiaAiDeletionJournal implements NodiaAiDeletionJournalPort {
  readonly enabled = false;
  async recordDeletions(): Promise<void> {}
  async recordResources(): Promise<void> {}
  async assertResourcesRecorded(): Promise<void> {}
  async confirmResources(): Promise<void> {}
}
