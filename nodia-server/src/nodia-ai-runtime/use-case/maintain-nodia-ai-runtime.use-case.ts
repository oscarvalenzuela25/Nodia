import { RecoverNodiaAiSecureFlowsUseCase } from '../../nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case.js';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { CleanupNodiaAiAttachmentsUseCase } from './cleanup-nodia-ai-attachments.use-case.js';
import { ExpireNodiaAiConversationsUseCase } from '../../nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.js';
import { CleanupNodiaAiRuntimeProofsUseCase } from './cleanup-nodia-ai-runtime-proofs.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';

@Injectable()
export class MaintainNodiaAiRuntimeUseCase {
  private nextSweep = 0;
  constructor(
    private readonly expiry: ExpireNodiaAiConversationsUseCase,
    private readonly cleanup: CleanupNodiaAiRuntimeProofsUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly secureFlows: RecoverNodiaAiSecureFlowsUseCase,
    @Optional() private readonly attachments?: CleanupNodiaAiAttachmentsUseCase,
  ) {}
  async execute(): Promise<void> {
    // Proof cleanup failure must not starve retention, and retention failure must not starve cleanup.
    const tasks: Promise<unknown>[] = [
      this.cleanup.execute(),
      this.secureFlows.execute(),
      ...(this.attachments ? [this.attachments.execute()] : []),
    ];
    if (Date.now() >= this.nextSweep) {
      tasks.push(
        this.expiry.execute().then(() => {
          this.nextSweep =
            Date.now() + this.policy.retention.sweep_seconds * 1000;
        }),
      );
    }
    const results = await Promise.allSettled(tasks);
    if (results.some((result) => result.status === 'rejected'))
      throw Error('nodia_ai_maintenance_unavailable');
  }
}
