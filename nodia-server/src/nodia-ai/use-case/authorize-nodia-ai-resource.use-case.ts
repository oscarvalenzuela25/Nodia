import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthorizeNodiaAiUseCase } from './authorize-nodia-ai.use-case.js';
import type {
  NodiaAiAccessRequirements,
  NodiaAiActorReference,
} from '../types/nodia-ai-authorization.types.js';

@Injectable()
export class AuthorizeNodiaAiResourceUseCase {
  constructor(private readonly authorize: AuthorizeNodiaAiUseCase) {}

  /** Owner and requirements must be read from persisted resources / backend registrations. */
  async execute(
    identity: NodiaAiActorReference,
    resource: { ownerId: string; access: 'read' | 'author' },
    requirements: NodiaAiAccessRequirements = {},
  ) {
    const actor = await this.authorize.execute(identity, requirements);
    if (resource.ownerId !== actor.actorId) {
      if (!actor.isSuperAdmin || resource.access !== 'read') {
        if (actor.isSuperAdmin)
          throw new ForbiddenException('nodia_ai:author_required');
        throw new NotFoundException('nodia_ai:resource_not_found');
      }
    }
    return actor;
  }
}
