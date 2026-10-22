import { Injectable } from '@nestjs/common';

export type NodiaAiOperationMode = 'normal' | 'quarantine';

/** Deployment gate, checked before creating either application context.
 * Quarantine is a prerequisite for restore, not proof of network isolation.
 */
@Injectable()
export class AssertNodiaAiOperationModeUseCase {
  execute(
    environment: Readonly<Record<string, unknown>>,
    purpose: 'serve' | 'restore' = 'serve',
  ): NodiaAiOperationMode {
    const raw = environment.NODIA_AI_OPERATION_MODE;
    const mode = raw === undefined ? 'normal' : raw;
    if (mode !== 'normal' && mode !== 'quarantine')
      throw new Error('nodia_ai:invalid_operation_mode');
    if (purpose === 'serve' && mode !== 'normal')
      throw new Error('nodia_ai:quarantine_blocks_startup');
    if (purpose === 'restore' && mode !== 'quarantine')
      throw new Error('nodia_ai:restore_requires_quarantine');
    return mode;
  }
}
