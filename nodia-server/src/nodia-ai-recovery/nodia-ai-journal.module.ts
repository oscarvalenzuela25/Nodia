import { Module } from '@nestjs/common';
import { NODIA_AI_DELETION_JOURNAL, DisabledNodiaAiDeletionJournal } from './types/deletion-journal.js';
import { createNodiaAiExternalRecovery, loadNodiaAiExternalRecoveryConfig } from './nodia-ai-external-recovery.factory.js';

@Module({
  providers: [{
    provide: NODIA_AI_DELETION_JOURNAL,
    useFactory: () => {
      const file = process.env.NODIA_AI_RECOVERY_CONFIG_FILE;
      return file === undefined ? new DisabledNodiaAiDeletionJournal()
        : createNodiaAiExternalRecovery(loadNodiaAiExternalRecoveryConfig(file)).store;
    },
  }],
  exports: [NODIA_AI_DELETION_JOURNAL],
})
export class NodiaAiJournalModule {}
