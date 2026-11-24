import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type {
  NodiaAiCvJournalResource,
  NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';

const logger = new Logger('NodiaCvDeletionJournal');

export async function protectNodiaCvDelete(
  journal: NodiaAiDeletionJournalPort | undefined,
  prepare: () => Promise<{ resource: NodiaAiCvJournalResource; now: Date }>,
  commit: () => Promise<void>,
): Promise<void> {
  if (!journal?.enabled) return commit();

  const { resource, now } = await prepare();
  try {
    await journal.recordResources({ resources: [resource], deleted_at: now.toISOString() });
    await journal.assertResourcesRecorded([resource]);
  } catch {
    throw new ServiceUnavailableException('nodiaCv:request_failed');
  }

  await commit();
  try {
    await journal.confirmResources([resource]);
  } catch {
    // SQL already committed. Keep the pending witness for the read-only reconciler.
    logger.warn('nodia_ai:deletion_journal_confirmation_pending');
  }
}
