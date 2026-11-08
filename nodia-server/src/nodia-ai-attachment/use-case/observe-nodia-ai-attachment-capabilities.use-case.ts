import { Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import {
  NodiaAiAdapterPort,
  isNodiaAiNativeFormatVerified,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import { ManageNodiaAiAttachmentUseCase } from './manage-nodia-ai-attachment.use-case.js';

import { observationIdentityManifest } from '../../nodia-ai-context/use-case/nodia-ai-observation-identity.js';

/** Exact current connection/model/session evidence, independent of saved mode flags. No inference is performed. */
@Injectable()
export class ObserveNodiaAiAttachmentCapabilitiesUseCase {
  constructor(
    private readonly attachments: NodiaAiAttachmentService,
    private readonly manage: ManageNodiaAiAttachmentUseCase,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly adapter: NodiaAiAdapterPort,
  ) {}
  async execute(identity: NodiaAiActorReference, chatId?: string) {
    const base = await this.manage.capabilities(identity);
    if (!chatId) return base;
    const snapshot = () =>
      this.attachments.transaction(async (manager) => {
        await lockAuthority(manager);
        const { chat } = await this.access.execute(
          manager,
          identity,
          chatId,
          'read',
          'attachment.capabilities',
        );
        return {
          revision: chat.revision,
          selection:
            chat.selected_connection_id &&
            chat.selected_mode &&
            chat.selected_model_id
              ? {
                  connection_id: chat.selected_connection_id,
                  mode: chat.selected_mode,
                  model_id: chat.selected_model_id,
                  effort_id: chat.selected_effort_id,
                }
              : null,
        };
      });
    const before = await snapshot();
    if (!before.selection) return base;
    let observation;
    try {
      observation = await this.adapter.observe(before.selection);
      if (before.selection.mode === 'api_key')
        observationIdentityManifest(before.selection, observation);
    } catch {
      return base;
    }
    const after = await snapshot();
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      !observation.available
    )
      return base;
    const verified = observation.verifiedAttachmentMediaTypes ?? [];
    return {
      ...base,
      native_media_types: [...verified],
      native_modalities: {
        image: verified.some((mime) =>
          isNodiaAiNativeFormatVerified(verified, 'image', mime),
        )
          ? true
          : null,
        pdf: verified.some((mime) =>
          isNodiaAiNativeFormatVerified(verified, 'pdf', mime),
        )
          ? true
          : null,
        audio: verified.some((mime) =>
          isNodiaAiNativeFormatVerified(verified, 'audio', mime),
        )
          ? true
          : null,
      },
    };
  }
}
